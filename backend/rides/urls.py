from django.urls import path

from .views import (
    RideListView,
    RideProposalAcceptView,
    RideProposalListCreateView,
    RideProposalRejectView,
)

urlpatterns = [
    path("proposals/", RideProposalListCreateView.as_view(), name="ride-proposals"),
    path(
        "proposals/<int:pk>/accept/",
        RideProposalAcceptView.as_view(),
        name="ride-proposal-accept",
    ),
    path(
        "proposals/<int:pk>/reject/",
        RideProposalRejectView.as_view(),
        name="ride-proposal-reject",
    ),
    path("", RideListView.as_view(), name="rides"),
]
