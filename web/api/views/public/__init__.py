from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.status import HTTP_201_CREATED, HTTP_400_BAD_REQUEST
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from authentication.models import Account
from cloudcache.models import Notebook, Note

from ...serializers import AccountSerializer, NotebookSerializer, NoteSerializer
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
        """ For listing, only show the Notebooks owned by the currently logged-in user. """
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
        """ For displaying, only show the Notebooks owned by the currently logged-in user. """
        return Notebook.objects.filter(owner=self.request.user)

# ----------------------------------------------------------------------------------------------------------------------

class NotebookNotesList(ListCreateAPIView):
    """ API endpoint for listing only those notes under a specific Notebook. Requires authentication. """

    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """ Retrieve only those notes which are contained within the Notebook whose ID is <pk> in the API endpoint. """
        notes = self.get_queryset().filter(notebook__id=pk)
        serializer = NoteSerializer(notes, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, pk):
        """ Create a new note under the Notebook whose ID is <pk> in the API endpoint. """

        # Add a 'notebook' parameter to the request data (or override it if it exists) to ensure the Note being posted
        # is owned by the Notebook whose ID is in the API endpoint URL.
        request.data['notebook'] = '/api/notebooks/{}/'.format(pk)

        serializer = NoteSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=HTTP_201_CREATED)

        return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

    def get_queryset(self):
        """ Only show Notes which are in Notebooks that are owned by the currently logged-in user. """
        return Note.objects.filter(notebook__owner=self.request.user)

# ----------------------------------------------------------------------------------------------------------------------

class NotebookNotebooksList(ListCreateAPIView):
    """ API endpoint for listing only those Notebooks under a specific Notebook. Requires authentication. """

    serializer_class = NotebookSerializer
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """ Retrieve notebooks which are contained within the Notebook whose ID is <pk> in the API endpoint. """
        notebooks = self.get_queryset().filter(parent__id=pk)
        serializer = NotebookSerializer(notebooks, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, pk):
        """ Create a new notebook under the Notebook whose ID is <pk> in the API endpoint. """

        # Add a 'notebook' parameter to the request data (or override it if it exists) to ensure the Note being posted
        # is owned by the Notebook whose ID is in the API endpoint URL.
        request.data['parent'] = '/api/notebooks/{}/'.format(pk)

        serializer = NotebookSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=HTTP_201_CREATED)

        return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

    def get_queryset(self):
        """ Only show Notebooks which are in Notebooks that are owned by the currently logged-in user. """
        return Notebook.objects.filter(owner=self.request.user)

# ----------------------------------------------------------------------------------------------------------------------

class NoteList(ListCreateAPIView):
    """ API endpoint for listing and creating Note. Requires authentication. """

    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """ Only show Notes which are in Notebooks that are owned by the currently logged-in user. """
        return Note.objects.filter(notebook__owner=self.request.user)


class NoteDetail(RetrieveUpdateDestroyAPIView):
    """ API endpoint which allows retrieving details for, updating, or deleting a specific Note. """

    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """ Only show Notes which are in Notebooks that are owned by the currently logged-in user. """
        return Note.objects.filter(notebook__owner=self.request.user)
