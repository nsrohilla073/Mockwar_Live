# core_game/admin.py

from django.contrib import admin
from django.utils.safestring import mark_safe
from .models import Wallet, Transaction, QuizCategory, GameTable, MatchHistory, UserProfile, WithdrawalRequest

@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ('user', 'deposit_balance', 'winning_balance', 'total_balance')
    search_fields = ('user__username',)

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'amount', 'tx_type', 'status', 'created_at')
    list_filter = ('tx_type', 'status', 'created_at')
    search_fields = ('user__username', 'razorpay_order_id')

@admin.register(WithdrawalRequest)
class WithdrawalRequestAdmin(admin.ModelAdmin):
    list_display = ('user', 'amount', 'upi_id', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('user__username', 'upi_id')
    actions = ['approve_withdrawals', 'reject_withdrawals']

    def get_queryset(self, request):
        return super().get_queryset(request).filter(tx_type='WITHDRAW')

    def approve_withdrawals(self, request, queryset):
        queryset.filter(status='PENDING').update(status='SUCCESS')
        self.message_user(request, "Selected withdrawals marked as SUCCESS.")
    approve_withdrawals.short_description = "✅ Approve Selected Withdrawals"

    def reject_withdrawals(self, request, queryset):
        for tx in queryset.filter(status='PENDING'):
            tx.status = 'FAILED'
            tx.save()
            wallet = tx.user.wallet
            wallet.winning_balance += tx.amount
            wallet.save()
        self.message_user(request, "Selected withdrawals REJECTED and refunded to wallet.")
    reject_withdrawals.short_description = "❌ Reject & Refund Withdrawals"


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('gamer_tag_display', 'full_name_display', 'mobile_number', 'email_display', 'state', 'district', 'photo_preview')
    search_fields = ('gamer_tag', 'mobile_number', 'user__first_name', 'user__email')
    list_filter = ('state', 'district')
    
    exclude = ('live_photo',)  
    readonly_fields = ('photo_preview_large',) 

    def gamer_tag_display(self, obj):
        return obj.gamer_tag if obj.gamer_tag else obj.user.username
    gamer_tag_display.short_description = 'Gamer Tag'

    def full_name_display(self, obj):
        return obj.user.first_name
    full_name_display.short_description = 'Full Name'

    def email_display(self, obj):
        return obj.user.email if obj.user.email else "Not Linked"
    email_display.short_description = 'Email Address'

    def photo_preview(self, obj):
        if obj.live_photo:
            return mark_safe(f'<img src="{obj.live_photo}" width="45" height="45" style="border-radius: 50%; object-fit: cover; border: 2px solid #3b82f6; box-shadow: 0 0 10px rgba(59,130,246,0.3);" />')
        return "❌ No Photo"
    photo_preview.short_description = 'Live Photo'

    def photo_preview_large(self, obj):
        if obj.live_photo:
            return mark_safe(f'<img src="{obj.live_photo}" width="200" style="border-radius: 12px; border: 3px solid #10b981; box-shadow: 0 0 15px rgba(16,185,129,0.3);" />')
        return "❌ KYC Not Uploaded"
    photo_preview_large.short_description = 'KYC Live Photo (Preview)'


@admin.register(QuizCategory)
class QuizCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_typing_test', 'is_active')
    list_filter = ('is_typing_test', 'is_active')


@admin.register(GameTable)
class GameTableAdmin(admin.ModelAdmin):
    # 🔥 अब यहाँ एडमिन पैनल से सीधे सवालों की संख्या और टाइमर लाइव एडिट कर सकते हैं
    list_display = ('category', 'entry_fee', 'prize_pool', 'max_players', 'questions_count', 'time_per_question', 'is_live')
    list_editable = ('is_live', 'questions_count', 'time_per_question')
    list_filter = ('category', 'is_live')


@admin.register(MatchHistory)
class MatchHistoryAdmin(admin.ModelAdmin):
    list_display = ('user', 'table', 'score', 'wpm', 'is_winner', 'prize_won', 'played_at')
    list_filter = ('is_winner', 'table', 'played_at')
    search_fields = ('user__username',)