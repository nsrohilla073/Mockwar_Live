from django import views
from django.urls import path
from .views import (
    ClaimBonusAPIView,
    CreateOrderAPIView,
    RazorpayWebhookAPIView,
    VerifyPaymentAPIView,
    GetWalletBalanceAPIView,
    WithdrawRequestAPIView,
    
    FirebaseLoginAPIView,
    CompleteRegistrationAPIView,
    
    GetLiveTablesAPIView,
    GetGameContentAPIView,
    PlayGameAPIView,
    SubmitGameResultAPIView,
    LeaderboardAPIView,  # 🔥 FIX: सही नाम यहाँ आ गया है
    
    UserDashboardHistoryAPIView,
    UserProfileAPIView
)

urlpatterns = [
    # 💰 Payment & Wallet URLs
    path('payment/create-order/', CreateOrderAPIView.as_view(), name='create_order'),
    path('payment/webhook/', RazorpayWebhookAPIView.as_view(), name='razorpay_webhook'),
    path('payment/verify/', VerifyPaymentAPIView.as_view(), name='verify_payment'),
    path('payment/wallet-balance/', GetWalletBalanceAPIView.as_view(), name='wallet_balance'),
    path('payment/withdraw/', WithdrawRequestAPIView.as_view(), name='withdraw'),
    path('payment/claim-bonus/', ClaimBonusAPIView.as_view(), name='claim_daily_bonus'),
    # 🔐 Auth URLs
    path('auth/firebase-login/', FirebaseLoginAPIView.as_view(), name='firebase_login'),
    path('auth/complete-registration/', CompleteRegistrationAPIView.as_view(), name='complete_registration'),
    
    # 🎮 Game & Lobby URLs
    path('game/live-tables/', GetLiveTablesAPIView.as_view(), name='live_tables'),
    path('game/content/<slug:category_slug>/', GetGameContentAPIView.as_view(), name='game_content'),
    path('game/play/', PlayGameAPIView.as_view(), name='play_game'),
    path('game/submit-result/', SubmitGameResultAPIView.as_view(), name='submit_result'),
    path('game/leaderboard/<str:table_slug>/', LeaderboardAPIView.as_view(), name='leaderboard'),

    # 👤 User Profile & History URLs
    path('user/dashboard-history/', UserDashboardHistoryAPIView.as_view(), name='dashboard_history'),
    path('user/profile/', UserProfileAPIView.as_view(), name='user_profile'),
]