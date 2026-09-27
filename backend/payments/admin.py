from django.contrib import admin

from .models import Payment, PaymentSettings


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "amount", "status", "credited", "external_id", "created_at")
    list_filter = ("status", "credited", "provider")
    search_fields = ("user__username", "external_id", "idempotency_key")


@admin.register(PaymentSettings)
class PaymentSettingsAdmin(admin.ModelAdmin):
    list_display = ("__str__", "updated_at", "updated_by")
    readonly_fields = ("updated_at", "updated_by")
