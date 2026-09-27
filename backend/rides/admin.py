from django.contrib import admin

from .models import Ride, RideProposal


@admin.register(RideProposal)
class RideProposalAdmin(admin.ModelAdmin):
    list_display = ("id", "client", "driver", "amount", "status", "expires_at", "created_at")
    list_filter = ("status",)
    search_fields = ("client__username", "driver__username")


@admin.register(Ride)
class RideAdmin(admin.ModelAdmin):
    list_display = ("id", "client", "driver", "amount", "created_at")
    search_fields = ("client__username", "driver__username")
