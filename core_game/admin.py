# core_game/admin.py

import csv
from django.http import HttpResponse
from django.contrib import admin
from django.utils.safestring import mark_safe
from .models import Wallet, Transaction, QuizCategory, GameTable, MatchHistory, UserProfile, WithdrawalRequest

class CustomAdminThemeMixin:
    class Media:
        css = {
             'all': ('admin_theme/gaming_admin.css',)
        }

# 🔴 NAYA: CSV Export Action for Accounting
@admin.action(description="📥 Export Selected Records to CSV")
def export_to_csv(modeladmin, request, queryset):
    opts = modeladmin.model._meta
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename={opts.verbose_name}.csv'
    writer = csv.writer(response)
    field_names = [field.name for field in opts.fields]
    writer.writerow(field_names)
    for obj in queryset:
        writer.writerow([getattr(obj, field) for field in field_names])
    return response

@admin.register(Wallet)
class WalletAdmin(CustomAdminThemeMixin, admin.ModelAdmin):
    list_display = ('user', 'deposit_balance', 'winning_balance', 'total_balance_display')
    search_fields = ('user__username', 'user__first_name', 'user__email')
    readonly_fields = ('user',) # 🔴 FIX: Don't allow changing user mapping

    def total_balance_display(self, obj):
        return f"₹{obj.total_balance()}"
    total_balance_display.short_description = 'Total Balance'

@admin.register(Transaction)
class TransactionAdmin(CustomAdminThemeMixin, admin.ModelAdmin):
    list_display = ('user', 'amount_display', 'tx_type', 'status_colored', 'created_at')
    list_filter = ('tx_type', 'status', 'created_at')
    search_fields = ('user__username', 'razorpay_order_id', 'upi_id')
    actions = [export_to_csv] # 🔴 NAYA: CSV Download feature
    
    # 🔴 SECURE FIX: Prevent admins from modifying old transactions manually
    def has_change_permission(self, request, obj=None):
        return False

    def amount_display(self, obj):
        return f"₹{obj.amount}"
    amount_display.short_description = 'Amount'

    # 🔴 NAYA: Color coded status
    def status_colored(self, obj):
        colors = {
            'SUCCESS': 'green',
            'PENDING': 'orange',
            'FAILED': 'red'
        }
        color = colors.get(obj.status, 'black')
        return mark_safe(f'<strong style="color: {color};">{obj.status}</strong>')
    status_colored.short_description = 'Status'

@admin.register(WithdrawalRequest)
class WithdrawalRequestAdmin(CustomAdminThemeMixin, admin.ModelAdmin):
    list_display = ('user', 'amount', 'upi_id', 'status_colored', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('user__username', 'upi_id')
    actions = ['approve_withdrawals', 'reject_withdrawals', export_to_csv]
    
    def has_change_permission(self, request, obj=None):
        return False # Protect records

    def get_queryset(self, request):
        return super().get_queryset(request).filter(tx_type='WITHDRAW')

    def status_colored(self, obj):
        colors = {'SUCCESS': 'green', 'PENDING': 'orange', 'FAILED': 'red'}
        return mark_safe(f'<strong style="color: {colors.get(obj.status, "black")};">{obj.status}</strong>')
    status_colored.short_description = 'Status'

    def approve_withdrawals(self, request, queryset):
        # 🔴 SECURE FIX: Only approve pending requests
        updated = queryset.filter(status='PENDING').update(status='SUCCESS')
        self.message_user(request, f"✅ {updated} withdrawals marked as SUCCESS.")
    approve_withdrawals.short_description = "✅ Approve Selected Withdrawals"

    def reject_withdrawals(self, request, queryset):
        count = 0
        for tx in queryset.filter(status='PENDING'):
            tx.status = 'FAILED'
            tx.save()
            wallet = tx.user.wallet
            wallet.winning_balance += tx.amount # Refund
            wallet.save()
            count += 1
        self.message_user(request, f"❌ {count} withdrawals REJECTED and refunded to wallets.")
    reject_withdrawals.short_description = "❌ Reject & Refund Withdrawals"


@admin.register(UserProfile)
class UserProfileAdmin(CustomAdminThemeMixin, admin.ModelAdmin):
    # 🔴 NAYA: Added Wallet Balances & Account Status directly in list view
    list_display = ('gamer_tag_display', 'mobile_number', 'wallet_balance', 'is_active_status', 'state', 'photo_preview')
    search_fields = ('gamer_tag', 'mobile_number', 'user__first_name', 'user__email', 'user__username')
    list_filter = ('state', 'user__is_active')
    actions = ['ban_users', 'unban_users', export_to_csv]
    
    exclude = ('live_photo',)  
    readonly_fields = ('photo_preview_large',) 

    def gamer_tag_display(self, obj):
        return obj.gamer_tag if obj.gamer_tag else obj.user.username
    gamer_tag_display.short_description = 'Gamer Tag'
    
    # 🔴 NAYA: Show wallet directly in profile
    def wallet_balance(self, obj):
        try:
            return f"₹{obj.user.wallet.total_balance()}"
        except:
            return "No Wallet"
    wallet_balance.short_description = 'Total Wallet'

    # 🔴 NAYA: Show if user is banned
    def is_active_status(self, obj):
        is_active = obj.user.is_active
        color = "green" if is_active else "red"
        text = "Active" if is_active else "BANNED"
        return mark_safe(f'<strong style="color: {color};">{text}</strong>')
    is_active_status.short_description = 'Account Status'

    def photo_preview(self, obj):
        if obj.live_photo:
            return mark_safe(f'<img src="{obj.live_photo}" width="45" height="45" style="border-radius: 50%; object-fit: cover; border: 2px solid #3b82f6; box-shadow: 0 0 10px rgba(59,130,246,0.3);" />')
        return "❌ No Photo"
    photo_preview.short_description = 'Live Photo'

    def photo_preview_large(self, obj):
        if obj.live_photo:
            return mark_safe(f'<img src="{obj.live_photo}" width="200" style="border-radius: 12px; border: 3px solid #10b981; box-shadow: 0 0 15px rgba(16,185,129,0.3);" />')
        return "❌ KYC Not Uploaded"
    photo_preview_large.short_description = 'KYC Live Photo'

    # 🔴 NAYA: 1-Click Ban/Unban Hackers
    def ban_users(self, request, queryset):
        for profile in queryset:
            profile.user.is_active = False
            profile.user.save()
        self.message_user(request, "Selected users have been BANNED.")
    ban_users.short_description = "⛔ Ban Selected Users"

    def unban_users(self, request, queryset):
        for profile in queryset:
            profile.user.is_active = True
            profile.user.save()
        self.message_user(request, "Selected users have been UNBANNED.")
    unban_users.short_description = "✅ Unban Selected Users"


@admin.register(QuizCategory)
class QuizCategoryAdmin(CustomAdminThemeMixin, admin.ModelAdmin):
    list_display = ('name', 'is_typing_test', 'is_active')
    list_filter = ('is_typing_test', 'is_active')


@admin.register(GameTable)
class GameTableAdmin(CustomAdminThemeMixin, admin.ModelAdmin):
    # 🔴 NAYA: Added total_matches played tracker
    list_display = ('category', 'entry_fee', 'prize_pool', 'max_players', 'questions_count', 'time_per_question', 'total_matches_played', 'is_live')
    list_editable = ('is_live', 'questions_count', 'time_per_question')
    list_filter = ('category', 'is_live')

    def total_matches_played(self, obj):
        return obj.match_records.count()
    total_matches_played.short_description = 'Total Matches'


@admin.register(MatchHistory)
class MatchHistoryAdmin(CustomAdminThemeMixin, admin.ModelAdmin):
    list_display = ('user', 'table', 'score', 'wpm_accuracy', 'is_winner_colored', 'prize_won', 'played_at')
    list_filter = ('is_winner', 'table', 'played_at')
    search_fields = ('user__username', 'user__profile__gamer_tag')
    actions = [export_to_csv]
    
    # 🔴 SECURE FIX: Prevent changing match history manually
    def has_change_permission(self, request, obj=None):
        return False

    def is_winner_colored(self, obj):
        if obj.is_winner:
            return mark_safe('<strong style="color: green;">🏆 WINNER</strong>')
        return mark_safe('<strong style="color: red;">❌ DEFEAT</strong>')
    is_winner_colored.short_description = 'Result'

    # 🔴 NAYA: Combined WPM and Accuracy for better analytics
    def wpm_accuracy(self, obj):
        if obj.table and 'typing' in obj.table.category.name.lower():
            return f"{obj.wpm} WPM | {obj.accuracy}%"
        return "N/A"
    wpm_accuracy.short_description = 'Typing Speed'