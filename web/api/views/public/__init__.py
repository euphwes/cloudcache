from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView

from authentication.models import Account
from cloudcache.models import Notebook

from ...serializers import AccountSerializer, NotebookSerializer
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


class NotebookList(ListCreateAPIView):

    serializer_class = NotebookSerializer

    def get_queryset(self):
        if self.request.user.is_anonymous():
            return Notebook.objects.none()
        return Notebook.objects.filter(owner=self.request.user).order_by('id')


class NotebookDetail(RetrieveUpdateDestroyAPIView):

    serializer_class = NotebookSerializer

    def get_queryset(self):
        if self.request.user.is_anonymous():
            return Notebook.objects.none()
        return Notebook.objects.filter(owner=self.request.user).order_by('id')