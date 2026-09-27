from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.models import DriverProfile
from payments.models import Payment

User = get_user_model()


class AdminClientSerializer(serializers.ModelSerializer):
    code = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    rides_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "full_name",
            "display_name",
            "email",
            "phone",
            "code",
            "balance",
            "is_active",
            "date_joined",
            "last_login",
            "rides_count",
        )
        read_only_fields = ("id", "username", "display_name", "date_joined", "last_login")

    def get_code(self, obj):
        profile = getattr(obj, "client_profile", None)
        return profile.code if profile else None

    def get_balance(self, obj):
        wallet = getattr(obj, "wallet", None)
        return str(wallet.balance) if wallet else "0.00"


class AdminDriverSerializer(serializers.ModelSerializer):
    vehicle_info = serializers.CharField(
        source="driver_profile.vehicle_info", required=False, allow_blank=True, max_length=120
    )
    rides_count = serializers.IntegerField(read_only=True, default=0)
    rides_total = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True, default=Decimal("0")
    )

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "full_name",
            "display_name",
            "email",
            "phone",
            "vehicle_info",
            "is_active",
            "date_joined",
            "last_login",
            "rides_count",
            "rides_total",
        )
        read_only_fields = ("id", "username", "display_name", "date_joined", "last_login")

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("driver_profile", None)
        instance = super().update(instance, validated_data)
        if profile_data is not None:
            profile, _ = DriverProfile.objects.get_or_create(user=instance)
            profile.vehicle_info = profile_data.get("vehicle_info", profile.vehicle_info)
            profile.save(update_fields=["vehicle_info"])
        return instance


class DriverCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6, max_length=128)
    vehicle_info = serializers.CharField(required=False, allow_blank=True, max_length=120)
    full_name = serializers.CharField(max_length=150)

    class Meta:
        model = User
        fields = ("username", "password", "full_name", "email", "phone", "vehicle_info")

    def create(self, validated_data):
        vehicle_info = validated_data.pop("vehicle_info", "")
        password = validated_data.pop("password")
        user = User(**validated_data, role=User.Role.DRIVER)
        user.set_password(password)
        user.save()
        profile, _ = DriverProfile.objects.get_or_create(user=user)
        profile.vehicle_info = vehicle_info
        profile.save(update_fields=["vehicle_info"])
        return user


class WalletOperationSerializer(serializers.Serializer):
    operation = serializers.ChoiceField(choices=[("credit", "Crédito"), ("debit", "Débito")])
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01"), max_value=Decimal("100000")
    )
    description = serializers.CharField(required=False, allow_blank=True, max_length=255)


class SetPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(
        required=False, allow_blank=True, max_length=128, help_text="Vazio gera uma senha."
    )

    def validate_password(self, value):
        if value and len(value) < 6:
            raise serializers.ValidationError("A senha deve ter pelo menos 6 caracteres.")
        return value


class AdminPaymentSerializer(serializers.ModelSerializer):
    client_id = serializers.IntegerField(source="user_id", read_only=True)
    client_name = serializers.CharField(source="user.display_name", read_only=True)
    client_code = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Payment
        fields = (
            "id",
            "client_id",
            "client_name",
            "client_code",
            "amount",
            "status",
            "status_display",
            "credited",
            "external_id",
            "created_at",
            "paid_at",
        )

    def get_client_code(self, obj):
        profile = getattr(obj.user, "client_profile", None)
        return profile.code if profile else None


class PixSettingsSerializer(serializers.Serializer):
    access_token = serializers.CharField(max_length=255, allow_blank=True, trim_whitespace=True)
