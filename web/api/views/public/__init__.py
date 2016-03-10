from rest_framework.viewsets import ModelViewSet

from authentication.models import Account

from ...serializers import AccountSerializer
from ...permissions import IsAccountSelfOrReadOnly

# ----------------------------------------------------------------------------------------------------------------------

class AccountViewSet(ModelViewSet):
    """ A set of API endpoints that allow Accounts to be viewed or edited. """
    queryset = Account.objects.all().order_by('id')
    serializer_class = AccountSerializer
    permission_classes = [IsAccountSelfOrReadOnly]
