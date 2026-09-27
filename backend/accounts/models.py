import secrets
import string

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class User(AbstractUser):
    class Role(models.TextChoices):
        CLIENT = "client", "Cliente"
        DRIVER = "driver", "Motorista"
        ADMIN = "admin", "Admin"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CLIENT)
    phone = models.CharField(max_length=20, blank=True)
    full_name = models.CharField(max_length=150, blank=True)

    def __str__(self):
        return f"{self.username} ({self.role})"

    @property
    def display_name(self):
        return self.full_name or self.get_full_name() or self.username


def generate_client_code(length: int = 4) -> str:
    alphabet = string.ascii_uppercase + string.digits
    alphabet = alphabet.replace("O", "").replace("0", "").replace("I", "").replace("1", "")
    suffix = "".join(secrets.choice(alphabet) for _ in range(length))
    return f"DN-{suffix}"


class ClientProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="client_profile")
    code = models.CharField(max_length=16, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} — {self.user.display_name}"

    @classmethod
    def create_unique_code(cls) -> str:
        for _ in range(50):
            code = generate_client_code()
            if not cls.objects.filter(code=code).exists():
                return code
        raise RuntimeError("Não foi possível gerar código único de cliente")


class DriverProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="driver_profile")
    is_approved = models.BooleanField(default=True)
    vehicle_info = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Motorista {self.user.display_name}"


@receiver(post_save, sender=User)
def create_role_profiles(sender, instance: User, created, **kwargs):
    if not created:
        return
    if instance.role == User.Role.CLIENT:
        ClientProfile.objects.get_or_create(
            user=instance,
            defaults={"code": ClientProfile.create_unique_code()},
        )
        from wallet.models import Wallet

        Wallet.objects.get_or_create(user=instance)
    elif instance.role == User.Role.DRIVER:
        DriverProfile.objects.get_or_create(user=instance)
