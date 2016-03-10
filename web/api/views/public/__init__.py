from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.status import HTTP_201_CREATED, HTTP_400_BAD_REQUEST
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

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
    """ API endpoint which allows retrieving details for, updating, or deleting a specific user. """

    queryset = Account.objects.all().order_by('id')
    serializer_class = AccountSerializer
    permission_classes = [IsAccountSelfOrReadOnly]

# ----------------------------------------------------------------------------------------------------------------------

class NotebookList(ListCreateAPIView):
    """ API endpoint for listing and creating Notebooks. Requires authentication. """

    serializer_class = NotebookSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """ For listing (via GET), only show the Notebooks owned by the currently logged-in user. """
        return Notebook.objects.filter(owner=self.request.user)


    def post(self, request, *args, **kwargs):
        """ When creating a new Notebook, only allow the user to create new Notebook for themselves. """

        # Get the Account detail url for the currently logged-in user.
        expected_owner = AccountSerializer(request.user, context={'request': request}).data['url']

        # Compare to the owner specified by the POST request. If they are not the same, complain about it. A user can
        # only create an notebook for their own account.
        if request.data['owner'] != expected_owner:
            message = 'You may only create notebooks for yourself.'
            return Response({'message': message}, status=HTTP_400_BAD_REQUEST)

        # Use the NotebookSerializer to build up the Notebook, checking for validity, etc
        # If valid, save the object and return a detail-style view along with status 201
        # If invalid, return error messages along with status 400
        notebook_serializer = NotebookSerializer(data=request.data, context={'request': request})
        if notebook_serializer.is_valid():
            notebook_serializer.save()
            return Response(notebook_serializer.data, status=HTTP_201_CREATED)

        return Response(notebook_serializer.errors, status=HTTP_400_BAD_REQUEST)


class NotebookDetail(RetrieveUpdateDestroyAPIView):
    """ API endpoint which allows retrieving details for, updating, or deleting a specific Notebook. """

    serializer_class = NotebookSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """ For displaying (via GET), only show the Notebooks owned by the currently logged-in user. """
        return Notebook.objects.filter(owner=self.request.user).order_by('id')
