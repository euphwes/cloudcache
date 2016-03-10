from rest_framework import permissions

# ----------------------------------------------------------------------------------------------------------------------

class IsAccountSelfOrReadOnly(permissions.BasePermission):
    """ Object-level permission to only allow Account owners to edit themselves. Anybody can POST a new Account. """

    def has_object_permission(self, request, view, obj):

        # Read actions are allowed to anybody
        if request.method in permissions.SAFE_METHODS:
            return True

        # Anybody can POST, to create a new user
        if request.method == 'POST':
            return True

        # Otherwise, only the user themselves can PUT or DELETE an Account
        return obj == request.user
