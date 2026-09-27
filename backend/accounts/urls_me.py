from django.urls import path

from .views import ClientLookupView, MeView

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("clients/lookup/", ClientLookupView.as_view(), name="client-lookup"),
]
