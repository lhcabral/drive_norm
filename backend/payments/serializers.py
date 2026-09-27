from decimal import Decimal
from rest_framework import serializers

from .models import Payment


class CreatePixSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("1"))


class PaymentSerializer(serializers.ModelSerializer):
    simulated = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = (
            "id",
            "simulated",
            "amount",
            "status",
            "provider",
            "external_id",
            "qr_code",
            "qr_code_base64",
            "ticket_url",
            "credited",
            "created_at",
            "paid_at",
        )

    def get_simulated(self, obj):
        return str(obj.external_id or "").startswith("sim-")
