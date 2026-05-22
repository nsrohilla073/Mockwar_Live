from django import views
from django.contrib import admin
from django.urls import path, include
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
    LeaderboardAPIView,  
    
    UserDashboardHistoryAPIView,
    UserProfileAPIView
)

# 🌟 CUSTOM ADMIN TEXT
admin.site.site_header = "MOCKWAR ESPORTS ADMIN"
admin.site.site_title = "MockWar Secure Portal"
admin.site.index_title = "Welcome to MockWar Command Center"

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
    path('game/content/<int:table_id>/', GetGameContentAPIView.as_view()),
    path('game/submit-result/', SubmitGameResultAPIView.as_view()),
    path('game/leaderboard/<int:table_id>/', LeaderboardAPIView.as_view()),

    path('game/play/', PlayGameAPIView.as_view(), name='play_game'),


    # 👤 User Profile & History URLs
    path('user/dashboard-history/', UserDashboardHistoryAPIView.as_view(), name='dashboard_history'),
    path('user/profile/', UserProfileAPIView.as_view(), name='user_profile'),
]