from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import ClientProfile

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    """Cadastro público: sempre cria cliente. Motoristas são cadastrados pelo admin."""

    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ("id", "username", "password", "email", "full_name", "phone")

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data, role=User.Role.CLIENT)
        user.set_password(password)
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    client_code = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    vehicle_info = serializers.SerializerMethodField()
    low_balance = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "full_name",
            "phone",
            "role",
            "client_code",
            "balance",
            "vehicle_info",
            "low_balance",
            "display_name",
        )
        read_only_fields = fields

    def get_client_code(self, obj):
        if obj.role != User.Role.CLIENT:
            return None
        profile = getattr(obj, "client_profile", None)
        return profile.code if profile else None

    def get_balance(self, obj):
        if obj.role != User.Role.CLIENT:
            return None
        wallet = getattr(obj, "wallet", None)
        return str(wallet.balance) if wallet else "0.00"

    def get_vehicle_info(self, obj):
        if obj.role != User.Role.DRIVER:
            return None
        profile = getattr(obj, "driver_profile", None)
        return profile.vehicle_info if profile else ""

    def get_low_balance(self, obj):
        if obj.role != User.Role.CLIENT:
            return False
        from django.conf import settings
        from decimal import Decimal

        wallet = getattr(obj, "wallet", None)
        if not wallet:
            return True
        threshold = Decimal(str(settings.LOW_BALANCE_THRESHOLD))
        return wallet.balance < threshold


class PasswordForgotSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=254)


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(min_length=6, max_length=128)


class ClientLookupSerializer(serializers.Serializer):
    code = serializers.CharField()
    full_name = serializers.CharField(read_only=True)
    balance = serializers.CharField(read_only=True)
    user_id = serializers.IntegerField(read_only=True)
