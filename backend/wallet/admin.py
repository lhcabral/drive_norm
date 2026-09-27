from django.contrib import admin

from .models import LedgerEntry, Wallet


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ("user", "balance", "updated_at")
    search_fields = ("user__username", "user__full_name")


@admin.register(LedgerEntry)
class LedgerEntryAdmin(admin.ModelAdmin):
    list_display = ("wallet", "entry_type", "amount", "balance_after", "created_at")
    list_filter = ("entry_type",)
    search_fields = ("wallet__user__username", "description", "idempotency_key")
    readonly_fields = (
        "wallet",
        "entry_type",
        "amount",
        "balance_after",
        "description",
        "created_by",
        "ride",
        "payment",
        "idempotency_key",
        "created_at",
    )
