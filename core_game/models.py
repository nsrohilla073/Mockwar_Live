from django.db import models
from django.contrib.auth.models import User

class Wallet(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="wallet")
    deposit_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00) 
    winning_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00) 

    def total_balance(self):
        return self.deposit_balance + self.winning_balance

    def __str__(self):
        return f"{self.user.username}'s Wallet - Total: ₹{self.total_balance()}"


class Transaction(models.Model):
    TX_TYPE_CHOICES = (
        ('DEPOSIT', 'Deposit via Razorpay'),
        ('WITHDRAW', 'Withdraw to Bank/UPI'),
        ('GAME_ENTRY', 'Entry Fee Deducted'),
        ('GAME_WIN', 'Prize Money Added'),
        ('BONUS', 'Daily Bonus Added'),
        ('REFUND', 'Game Tied Refund'),
    )
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
    )
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="transactions")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    tx_type = models.CharField(max_length=20, choices=TX_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    upi_id = models.CharField(max_length=100, blank=True, null=True)
    razorpay_order_id = models.CharField(max_length=100, blank=True, null=True)
    razorpay_payment_id = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.tx_type} - ₹{self.amount} ({self.status})"


class QuizCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    is_typing_test = models.BooleanField(default=False) 
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class GameTable(models.Model):
    category = models.ForeignKey(QuizCategory, on_delete=models.CASCADE, related_name="game_tables")
    entry_fee = models.DecimalField(max_digits=10, decimal_places=2) 
    prize_pool = models.DecimalField(max_digits=10, decimal_places=2) 
    max_players = models.IntegerField(default=2) 
    questions_count = models.IntegerField(default=5, help_text="इस टेबल में कितने सवाल होंगे?")
    time_per_question = models.IntegerField(default=12, help_text="हर सवाल के लिए कितने सेकंड मिलेंगे?")
    is_live = models.BooleanField(default=True) 

    def __str__(self):
        return f"{self.category.name} Table - Entry: ₹{self.entry_fee} | Prize: ₹{self.prize_pool}"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    firebase_uid = models.CharField(max_length=255, unique=True, null=True, blank=True)
    gamer_tag = models.CharField(max_length=50, unique=True, null=True, blank=True)
    mobile_number = models.CharField(max_length=15, unique=True, null=True, blank=True)
    dob = models.DateField(null=True, blank=True)
    state = models.CharField(max_length=100, null=True, blank=True)
    district = models.CharField(max_length=100, null=True, blank=True)
    live_photo = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"{self.gamer_tag if self.gamer_tag else self.user.username}'s Profile"


class MatchHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="match_histories")
    table = models.ForeignKey(GameTable, on_delete=models.SET_NULL, null=True, related_name="match_records")
    score = models.IntegerField(default=0)
    wpm = models.IntegerField(default=0, null=True, blank=True)
    accuracy = models.IntegerField(default=100, null=True, blank=True)
    is_winner = models.BooleanField(default=False)
    prize_won = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    played_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - Score: {self.score} - Won: {self.is_winner}"


class WithdrawalRequest(Transaction):
    class Meta:
        proxy = True 
        verbose_name = 'Withdrawal Request'
        verbose_name_plural = 'Withdrawal Requests'