# core_game/views.py

import razorpay
import json
import os
import random
import time
from decimal import Decimal
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.contrib.auth.models import User
from django.db import transaction
import traceback
from datetime import datetime
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.cache import cache
import firebase_admin
from firebase_admin import credentials
from firebase_admin import auth as firebase_auth

from .models import Wallet, Transaction, UserProfile, QuizCategory, GameTable, MatchHistory

if not firebase_admin._apps:
    firebase_key_path = os.path.join(settings.BASE_DIR, 'firebase-adminsdk.json')
    cred = credentials.Certificate(firebase_key_path)
    firebase_admin.initialize_app(cred)

RAZORPAY_KEY_ID = getattr(settings, 'RAZORPAY_KEY_ID', 'YOUR_TEST_KEY_ID')
RAZORPAY_KEY_SECRET = getattr(settings, 'RAZORPAY_KEY_SECRET', 'YOUR_TEST_KEY_SECRET')
RAZORPAY_WEBHOOK_SECRET = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', 'my_secret_token')
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


class CreateOrderAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    def post(self, request):
        amount = request.data.get('amount')
        if not amount or float(amount) <= 0: return Response({"error": "Invalid amount"}, status=status.HTTP_400_BAD_REQUEST)
        amount_in_paise = int(float(amount) * 100)
        notes = {'user_id': request.user.id, 'username': request.user.username}
        order_params = {'amount': amount_in_paise, 'currency': 'INR', 'payment_capture': 1, 'notes': notes}
        try:
            razorpay_order = razorpay_client.order.create(data=order_params)
            Transaction.objects.create(user=request.user, amount=amount, tx_type='DEPOSIT', status='PENDING', razorpay_order_id=razorpay_order['id'])
            return Response({"order_id": razorpay_order['id'], "amount": amount, "key_id": RAZORPAY_KEY_ID}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@method_decorator(csrf_exempt, name='dispatch')
class RazorpayWebhookAPIView(APIView):
    permission_classes = []
    def post(self, request):
        webhook_signature = request.META.get('HTTP_X_RAZORPAY_SIGNATURE')
        payload = request.body.decode('utf-8')
        try:
            razorpay_client.utility.verify_webhook_signature(payload, webhook_signature, RAZORPAY_WEBHOOK_SECRET)
            data = json.loads(payload)
            if data['event'] == 'payment.captured':
                payment_entity = data['payload']['payment']['entity']
                order_id = payment_entity['order_id']
                payment_id = payment_entity['id']
                try:
                    transaction_obj = Transaction.objects.get(razorpay_order_id=order_id, status='PENDING')
                    transaction_obj.status = 'SUCCESS'
                    transaction_obj.razorpay_payment_id = payment_id
                    transaction_obj.save()
                    wallet = Wallet.objects.get(user=transaction_obj.user)
                    wallet.deposit_balance += transaction_obj.amount
                    wallet.save()
                    return HttpResponse("Wallet Updated Successfully", status=200)
                except Transaction.DoesNotExist:
                    return HttpResponse("Transaction Not Found or Already Processed", status=200)
            return HttpResponse("Event ignored", status=200)
        except razorpay.errors.SignatureVerificationError:
            return HttpResponse("Invalid Webhook Signature", status=400)

class VerifyPaymentAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    def post(self, request):
        razorpay_payment_id = request.data.get('razorpay_payment_id')
        razorpay_order_id = request.data.get('razorpay_order_id')
        razorpay_signature = request.data.get('razorpay_signature')
        if not all([razorpay_payment_id, razorpay_order_id, razorpay_signature]): return Response({"error": "Missing required signature fields"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            params_dict = {'razorpay_order_id': razorpay_order_id, 'razorpay_payment_id': razorpay_payment_id, 'razorpay_signature': razorpay_signature}
            razorpay_client.utility.verify_payment_signature(params_dict)
            transaction_obj = Transaction.objects.get(razorpay_order_id=razorpay_order_id, user=request.user)
            if transaction_obj.status == 'SUCCESS': return Response({"message": "Wallet already updated"}, status=status.HTTP_200_OK)
            transaction_obj.status = 'SUCCESS'
            transaction_obj.razorpay_payment_id = razorpay_payment_id
            transaction_obj.save()
            wallet = Wallet.objects.get(user=request.user)
            wallet.deposit_balance += transaction_obj.amount
            wallet.save()
            return Response({"message": "Payment Verified & Wallet Updated"}, status=status.HTTP_200_OK)
        except razorpay.errors.SignatureVerificationError:
            return Response({"error": "Signature verification failed"}, status=status.HTTP_400_BAD_REQUEST)
        except Transaction.DoesNotExist:
            return Response({"error": "Transaction match not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class GetWalletBalanceAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    def get(self, request):
        try:
            wallet = Wallet.objects.get(user=request.user)
            return Response({"deposit_balance": wallet.deposit_balance, "winning_balance": wallet.winning_balance, "total_balance": wallet.total_balance()}, status=status.HTTP_200_OK)
        except Wallet.DoesNotExist:
            return Response({"error": "Wallet not found"}, status=status.HTTP_404_NOT_FOUND)

class WithdrawRequestAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    def post(self, request):
        amount = Decimal(str(request.data.get('amount', 0)))
        upi_id = request.data.get('upi_id')
        if amount < 50: return Response({"error": "Minimum withdrawal amount is ₹50"}, status=status.HTTP_400_BAD_REQUEST)
        if not upi_id: return Response({"error": "UPI ID is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            with transaction.atomic():
                wallet = Wallet.objects.select_for_update().get(user=request.user)
                if wallet.winning_balance < amount: return Response({"error": "Insufficient Winning Balance."}, status=status.HTTP_400_BAD_REQUEST)
                wallet.winning_balance -= amount
                wallet.save()
                Transaction.objects.create(user=request.user, amount=amount, tx_type='WITHDRAW', status='PENDING', upi_id=upi_id)
            return Response({"success": True, "message": "Withdrawal request placed! Pending admin approval."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ClaimBonusAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            user = request.user
            today = timezone.localdate()
            already_claimed = Transaction.objects.filter(user=user, tx_type='BONUS', created_at__date=today).exists()
            if already_claimed: return Response({"error": "You have already claimed today's bonus. Come back tomorrow!"}, status=status.HTTP_400_BAD_REQUEST)
            wallet = Wallet.objects.get(user=user)
            wallet.deposit_balance += Decimal('5.00')
            wallet.save()
            Transaction.objects.create(user=user, amount=Decimal('5.00'), tx_type='BONUS', status='SUCCESS', razorpay_order_id=f"BONUS_{int(time.time())}")
            return Response({"success": True, "message": "₹5 Bonus Cash added to your wallet!"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PlayGameAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    def post(self, request):
        entry_fee_str = str(request.data.get('entry_fee', 0))
        entry_fee = Decimal(entry_fee_str)
        try:
            with transaction.atomic():
                wallet = Wallet.objects.select_for_update().get(user=request.user)
                if wallet.total_balance() >= entry_fee:
                    if wallet.deposit_balance >= entry_fee:
                        wallet.deposit_balance -= entry_fee
                    else:
                        remaining = entry_fee - wallet.deposit_balance
                        wallet.deposit_balance = Decimal('0.00')
                        wallet.winning_balance -= remaining
                    wallet.save()
                    Transaction.objects.create(user=request.user, amount=entry_fee, tx_type='GAME_ENTRY', status='SUCCESS')
                    return Response({"success": True, "message": "Entry fee deducted"}, status=status.HTTP_200_OK)
                else:
                    return Response({"error": "Insufficient balance"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class FirebaseLoginAPIView(APIView):
    authentication_classes = []
    permission_classes = [] 
    def post(self, request):
        id_token = request.data.get('id_token')
        if not id_token: return Response({"error": "Token is missing"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            decoded_token = firebase_auth.verify_id_token(id_token)
            uid = decoded_token.get('uid')
            raw_phone = decoded_token.get('phone_number', '') 
            email = decoded_token.get('email', '')               
            phone_10_digit = raw_phone[-10:] if raw_phone else ''
            try:
                user = User.objects.get(username=uid)
                profile, created = UserProfile.objects.get_or_create(user=user)
                if not profile.gamer_tag: profile.gamer_tag = f"PRO_ADMIN{random.randint(100, 999)}"; profile.save()
                Wallet.objects.get_or_create(user=user)
                refresh = RefreshToken.for_user(user)
                return Response({"is_new_user": False, "refresh": str(refresh), "access": str(refresh.access_token)}, status=status.HTTP_200_OK)
            except User.DoesNotExist:
                existing_user = None
                if phone_10_digit:
                    profile = UserProfile.objects.filter(mobile_number__endswith=phone_10_digit).first()
                    if profile: existing_user = profile.user
                if not existing_user and email:
                    existing_user = User.objects.filter(email=email).first()
                if existing_user:
                    profile, created = UserProfile.objects.get_or_create(user=existing_user)
                    if not profile.gamer_tag: profile.gamer_tag = f"PRO_ADMIN{random.randint(100, 999)}"
                    if phone_10_digit and not profile.mobile_number: profile.mobile_number = phone_10_digit
                    profile.save()
                    Wallet.objects.get_or_create(user=existing_user)
                    refresh = RefreshToken.for_user(existing_user)
                    return Response({"is_new_user": False, "refresh": str(refresh), "access": str(refresh.access_token)}, status=status.HTTP_200_OK)
                return Response({"is_new_user": True, "uid": uid, "phone": raw_phone, "email": email}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": "Server error during verification."}, status=status.HTTP_401_UNAUTHORIZED)

class CompleteRegistrationAPIView(APIView):
    authentication_classes = []
    permission_classes = []
    @transaction.atomic
    def post(self, request):
        uid = request.data.get('uid')
        name = request.data.get('name', '').strip()
        phone = request.data.get('phone', '')
        email = request.data.get('email', '') 
        dob = request.data.get('dob')
        state = request.data.get('state')
        district = request.data.get('district')
        live_photo = request.data.get('live_photo')
        referred_by_code = request.data.get('referred_by', '').strip().upper()
        if not dob: dob = None
        try:
            safe_name = "".join(e for e in name if e.isalnum()).upper()
            prefix = safe_name[:4] if len(safe_name) >= 4 else safe_name.ljust(4, 'X')
            suffix = phone[-4:] if len(phone) >= 4 else str(random.randint(1000, 9999))
            custom_gamer_tag = f"{prefix}{suffix}"
            while UserProfile.objects.filter(gamer_tag=custom_gamer_tag).exists():
                custom_gamer_tag = f"{prefix}{random.randint(1000, 9999)}"
            with transaction.atomic():
                secure_password = f"MockWarSecret_{uid}"
                new_user = User.objects.create_user(username=uid, password=secure_password, first_name=name, email=email)
                UserProfile.objects.create(user=new_user, firebase_uid=uid, gamer_tag=custom_gamer_tag, mobile_number=phone, dob=dob, state=state, district=district, live_photo=live_photo)
                new_wallet, _ = Wallet.objects.get_or_create(user=new_user)
                if referred_by_code:
                    actual_tag = referred_by_code.replace("WIN", "")
                    referrer_profile = UserProfile.objects.filter(gamer_tag=actual_tag).first()
                    if referrer_profile:
                        referrer_user = referrer_profile.user
                        referrer_wallet = Wallet.objects.get(user=referrer_user)
                        referrer_wallet.deposit_balance += Decimal('50.00'); referrer_wallet.save()
                        Transaction.objects.create(user=referrer_user, amount=Decimal('50.00'), tx_type='BONUS', status='SUCCESS', razorpay_order_id=f"REF_REWARD_{int(time.time())}")
                        new_wallet.deposit_balance += Decimal('50.00'); new_wallet.save()
                        Transaction.objects.create(user=new_user, amount=Decimal('50.00'), tx_type='BONUS', status='SUCCESS', razorpay_order_id=f"WELCOME_BONUS_{int(time.time())}")
            refresh = RefreshToken.for_user(new_user)
            return Response({"message": "Account created successfully!", "username": custom_gamer_tag, "refresh": str(refresh), "access": str(refresh.access_token)}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GetLiveTablesAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    def get(self, request):
        try:
            active_tables = GameTable.objects.filter(is_live=True)
            tables_data = []
            for table in active_tables:
                slug = table.category.name.lower().replace(' ', '-')
                is_typing = 'typing' in table.category.name.lower()
                tables_data.append({"id": table.id, "category_name": table.category.name, "slug": slug, "entry_fee": float(table.entry_fee), "prize_pool": float(table.prize_pool), "max_players": table.max_players, "questions_count": table.questions_count if not is_typing else 1, "total_time": f"{table.time_per_question * table.questions_count}s" if not is_typing else "60s"})
            return Response({"tables": tables_data}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GetGameContentAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    def get(self, request, category_slug):
        try:
            if str(category_slug).isdigit():
                table = GameTable.objects.filter(id=int(category_slug)).first()
            else:
                table = GameTable.objects.filter(category__name__iexact=str(category_slug).replace('-', ' ')).first()
            if not table: table = GameTable.objects.first()
            if not table: return Response({"error": "No tables available"}, status=status.HTTP_404_NOT_FOUND)
            
            max_players = table.max_players
            
            # 🎯 LOBBY MATCHMAKING (SIRF ROOM ASSIGN HOGA)
            match_queue_key = f"match_queue_{category_slug}"
            queue_data = cache.get(match_queue_key)
            
            if queue_data:
                room_id = queue_data['room_id']
                queue_data['player_count'] += 1
                if queue_data['player_count'] >= max_players:
                    cache.delete(match_queue_key)  # Room Full!
                else:
                    cache.set(match_queue_key, queue_data, timeout=65)
            else:
                room_id = f"room_{int(time.time())}_{random.randint(1000, 9999)}"
                if max_players > 1:
                    cache.set(match_queue_key, {"room_id": room_id, "player_count": 1}, timeout=65)

            return Response({
                "room_id": room_id,
                "max_players": max_players,
                "is_typing_test": 'typing' in category_slug.lower()
            }, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            traceback.print_exc() 
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SubmitGameResultAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            user = request.user
            table_slug = request.data.get('table_id')
            score = int(request.data.get('score', 0))
            wpm = int(request.data.get('wpm', 0))
            status_result = request.data.get('status', 'LOSS')

            table = GameTable.objects.filter(category__name__iexact=table_slug.replace('-', ' ')).first()
            if not table: return Response({"error": "Table not found"}, status=status.HTTP_404_NOT_FOUND)

            is_typing = 'typing' in table_slug.lower()
            if not is_typing:
                max_points_per_q = 10 + table.time_per_question
                max_possible_score = table.questions_count * max_points_per_q
                if score > max_possible_score:
                    return Response({"error": "Anti-Cheat: Impossible score detected."}, status=status.HTTP_403_FORBIDDEN)
            else:
                if wpm > 250 or score > (wpm + 100): 
                    return Response({"error": "Anti-Cheat: Superhuman speed detected."}, status=status.HTTP_403_FORBIDDEN)

            prize_won = Decimal('0.00')
            tx_type = None

            with transaction.atomic():
                wallet = Wallet.objects.select_for_update().get(user=user)
                
                # 🔴 FIX: 1 Minute ki jagah 10 Seconds ka lock
                already_submitted = MatchHistory.objects.filter(
                    user=user, table=table, 
                    played_at__gte=timezone.now() - timezone.timedelta(seconds=10)
                ).exists()
                
                if already_submitted:
                    return Response({"error": "Result already submitted"}, status=status.HTTP_400_BAD_REQUEST)

                if status_result == 'WIN':
                    prize_won = Decimal(str(table.prize_pool))
                    wallet.winning_balance += prize_won
                    tx_type = 'GAME_WIN'
                elif status_result == 'DRAW':
                    prize_won = Decimal(str(table.entry_fee))
                    wallet.deposit_balance += prize_won
                    tx_type = 'REFUND'

                wallet.save()
                MatchHistory.objects.create(user=user, table=table, score=score, wpm=wpm, is_winner=(status_result == 'WIN'), prize_won=prize_won)
                if tx_type:
                    Transaction.objects.create(user=user, amount=prize_won, tx_type=tx_type, status='SUCCESS', razorpay_order_id=f"GAME_REWARD_{int(time.time())}")

            return Response({"prize_won": prize_won, "match_status": status_result}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class LeaderboardAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    def get(self, request, table_slug):
        try:
            table = GameTable.objects.filter(category__name__iexact=table_slug.replace('-', ' ')).first()
            if not table: return Response({"error": "Table not found"}, status=status.HTTP_404_NOT_FOUND)

            history = MatchHistory.objects.filter(table=table).order_by('-score')
            leaderboard = []
            seen_users = set()
            for match in history:
                if match.user.id not in seen_users:
                    seen_users.add(match.user.id)
                    gamer_tag = match.user.profile.gamer_tag if hasattr(match.user, 'profile') and match.user.profile.gamer_tag else match.user.username
                    leaderboard.append({"rank": len(leaderboard) + 1, "username": gamer_tag, "score": match.score})
                if len(leaderboard) >= 10: break
            return Response({"leaderboard": leaderboard}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class UserDashboardHistoryAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    def get(self, request):
        try:
            matches = MatchHistory.objects.filter(user=request.user).order_by('-played_at')[:3]
            match_data = [{"topic": m.table.category.name if m.table else "Match Battle", "score": m.score, "is_winner": m.is_winner, "prize": float(m.prize_won), "date": timezone.localtime(m.played_at).strftime("%d %b, %H:%M")} for m in matches]
            txs = Transaction.objects.filter(user=request.user).order_by('-created_at')[:10]
            tx_data = [{"amount": float(tx.amount), "type": tx.tx_type, "status": tx.status, "date": timezone.localtime(tx.created_at).strftime("%d %b, %H:%M")} for tx in txs]
            return Response({"matches": match_data, "transactions": tx_data}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserProfileAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    def get(self, request):
        try:
            user = request.user
            profile = user.profile
            wallet = user.wallet
            matches_played = MatchHistory.objects.filter(user=user).count()
            matches_won = MatchHistory.objects.filter(user=user, is_winner=True).count()
            return Response({"gamer_tag": profile.gamer_tag, "full_name": user.first_name, "email": user.email, "phone": profile.mobile_number, "live_photo": profile.live_photo, "deposit_balance": wallet.deposit_balance, "winning_balance": wallet.winning_balance, "matches_played": matches_played, "matches_won": matches_won, "dob": profile.dob, "state": profile.state, "district": profile.district}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)