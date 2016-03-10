from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView

from authentication.models import Account

from ...serializers import AccountSerializer
from ...permissions import IsAccountSelfOrReadOnly

# ----------------------------------------------------------------------------------------------------------------------

class AccountList(ListCreateAPIView):
    """ API endpoint which allows listing users, or POSTing a new one. """

    queryset = Account.objects.all().order_by('id')
    serializer_class = AccountSerializer


class AccountDetail(RetrieveUpdateDestroyAPIView):
    """ API endpoint which allows retrieving details for, updating, or deleting for a specific user. """

    queryset = Account.objects.all().order_by('id')
    serializer_class = AccountSerializer
    permission_classes = [IsAccountSelfOrReadOnly]
