from django.contrib import admin

from .models import LandingContent


@admin.register(LandingContent)
class LandingContentAdmin(admin.ModelAdmin):
    list_display = ("__str__", "updated_at", "updated_by")
    readonly_fields = ("updated_at", "updated_by")
