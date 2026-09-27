from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from accounts.models import ClientProfile, DriverProfile
from wallet.models import Wallet

User = get_user_model()


class Command(BaseCommand):
    help = "Cria usuários de demonstração (cliente e motorista)"

    def handle(self, *args, **options):
        client, created = User.objects.get_or_create(
            username="cliente",
            defaults={
                "role": User.Role.CLIENT,
                "full_name": "Cliente Demo",
                "email": "cliente@drivenorm.local",
                "phone": "11999990001",
            },
        )
        if created:
            client.set_password("cliente123")
            client.save()
        else:
            if client.role != User.Role.CLIENT:
                client.role = User.Role.CLIENT
                client.save(update_fields=["role"])
            ClientProfile.objects.get_or_create(
                user=client, defaults={"code": ClientProfile.create_unique_code()}
            )
            Wallet.objects.get_or_create(user=client)

        driver, created = User.objects.get_or_create(
            username="motorista",
            defaults={
                "role": User.Role.DRIVER,
                "full_name": "Motorista Demo",
                "email": "motorista@drivenorm.local",
                "phone": "11999990002",
            },
        )
        if created:
            driver.set_password("motorista123")
            driver.save()
        else:
            if driver.role != User.Role.DRIVER:
                driver.role = User.Role.DRIVER
                driver.save(update_fields=["role"])
            DriverProfile.objects.get_or_create(user=driver)

        admin_user, created = User.objects.get_or_create(
            username="admin",
            defaults={
                "role": User.Role.ADMIN,
                "full_name": "Admin",
                "email": "admin@drivenorm.local",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            admin_user.set_password("admin123")
            admin_user.save()

        code = client.client_profile.code
        self.stdout.write(self.style.SUCCESS("Usuários demo prontos:"))
        self.stdout.write(f"  cliente / cliente123  código={code}")
        self.stdout.write("  motorista / motorista123")
        self.stdout.write("  admin / admin123")
