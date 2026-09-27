from decimal import Decimal
from rest_framework import serializers

from .models import LedgerEntry, Wallet


class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = ("balance", "updated_at")


class LedgerEntrySerializer(serializers.ModelSerializer):
    entry_type_display = serializers.CharField(source="get_entry_type_display", read_only=True)

    class Meta:
        model = LedgerEntry
        fields = (
            "id",
            "entry_type",
            "entry_type_display",
            "amount",
            "balance_after",
            "description",
            "created_at",
            "ride",
            "payment",
        )


class ManualCreditSerializer(serializers.Serializer):
    client_code = serializers.CharField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    description = serializers.CharField(required=False, allow_blank=True, max_length=255)
