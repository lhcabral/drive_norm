from rest_framework import permissions


class IsSiteAdmin(permissions.BasePermission):
    message = "Apenas administradores podem acessar o painel."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.role == "admin" or user.is_staff))
