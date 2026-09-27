from decimal import Decimal
from rest_framework import serializers

from .models import Ride, RideProposal


class RideProposalCreateSerializer(serializers.Serializer):
    client_code = serializers.CharField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))


class RideProposalSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.display_name", read_only=True)
    driver_name = serializers.CharField(source="driver.display_name", read_only=True)
    client_code = serializers.SerializerMethodField()
    seconds_remaining = serializers.SerializerMethodField()

    class Meta:
        model = RideProposal
        fields = (
            "id",
            "client",
            "driver",
            "client_name",
            "driver_name",
            "client_code",
            "amount",
            "status",
            "created_at",
            "expires_at",
            "responded_at",
            "seconds_remaining",
        )

    def get_client_code(self, obj):
        profile = getattr(obj.client, "client_profile", None)
        return profile.code if profile else None

    def get_seconds_remaining(self, obj):
        from django.utils import timezone

        if obj.status != RideProposal.Status.PENDING:
            return 0
        delta = (obj.expires_at - timezone.now()).total_seconds()
        return max(0, int(delta))


class RideSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.display_name", read_only=True)
    driver_name = serializers.CharField(source="driver.display_name", read_only=True)
    client_code = serializers.SerializerMethodField()

    class Meta:
        model = Ride
        fields = (
            "id",
            "client",
            "driver",
            "client_name",
            "driver_name",
            "client_code",
            "amount",
            "proposal",
            "created_at",
        )

    def get_client_code(self, obj):
        profile = getattr(obj.client, "client_profile", None)
        return profile.code if profile else None
