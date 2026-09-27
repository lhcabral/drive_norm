from decimal import Decimal

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone


class Wallet(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wallet"
    )
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Carteira {self.user} — R$ {self.balance}"


class LedgerEntry(models.Model):
    class EntryType(models.TextChoices):
        CREDIT_MANUAL = "CREDIT_MANUAL", "Crédito manual"
        CREDIT_PIX = "CREDIT_PIX", "Crédito PIX"
        DEBIT_RIDE = "DEBIT_RIDE", "Débito corrida"
        ADJUSTMENT = "ADJUSTMENT", "Ajuste"

    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name="entries")
    entry_type = models.CharField(max_length=20, choices=EntryType.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ledger_created",
    )
    ride = models.ForeignKey(
        "rides.Ride",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ledger_entries",
    )
    payment = models.ForeignKey(
        "payments.Payment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ledger_entries",
    )
    idempotency_key = models.CharField(max_length=64, blank=True, null=True, unique=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.entry_type} {self.amount} → {self.balance_after}"


class InsufficientBalance(Exception):
    pass


class WalletService:
    @staticmethod
    @transaction.atomic
    def apply(
        *,
        wallet: Wallet,
        amount: Decimal,
        entry_type: str,
        description: str = "",
        created_by=None,
        ride=None,
        payment=None,
        idempotency_key: str | None = None,
        allow_negative: bool = False,
    ) -> LedgerEntry:
        if idempotency_key:
            existing = LedgerEntry.objects.filter(idempotency_key=idempotency_key).first()
            if existing:
                return existing

        wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)
        amount = Decimal(amount).quantize(Decimal("0.01"))
        new_balance = wallet.balance + amount
        if not allow_negative and new_balance < 0:
            raise InsufficientBalance("Saldo insuficiente.")

        wallet.balance = new_balance
        wallet.save(update_fields=["balance", "updated_at"])

        return LedgerEntry.objects.create(
            wallet=wallet,
            entry_type=entry_type,
            amount=amount,
            balance_after=new_balance,
            description=description,
            created_by=created_by,
            ride=ride,
            payment=payment,
            idempotency_key=idempotency_key,
        )
