from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import ClientProfile, DriverProfile, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "full_name", "role", "phone", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Drive Norm", {"fields": ("role", "phone", "full_name")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Drive Norm", {"fields": ("role", "phone", "full_name")}),
    )


@admin.register(ClientProfile)
class ClientProfileAdmin(admin.ModelAdmin):
    list_display = ("code", "user", "created_at")
    search_fields = ("code", "user__username", "user__full_name")


@admin.register(DriverProfile)
class DriverProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "is_approved", "vehicle_info", "created_at")
    list_filter = ("is_approved",)
