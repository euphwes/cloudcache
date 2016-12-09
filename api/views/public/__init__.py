from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.status import HTTP_201_CREATED, HTTP_400_BAD_REQUEST
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from authentication.models import Account
from cloudcache.models import Note, ChecklistItem, Checklist

from ...serializers import AccountSerializer, NoteSerializer, ChecklistItemSerializer, ChecklistSerializer
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

class ChecklistItemsList(ListCreateAPIView):
    """ API endpoint for listing only those items under a specific Checklist. Requires authentication. """

    serializer_class = ChecklistItemSerializer
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """ Retrieve only those items which are contained within the Checklist whose ID is <pk>
        in the API endpoint. """

        items = self.get_queryset().filter(checklist__id=pk)
        serializer = ChecklistItemSerializer(items, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, pk):
        """ Create a new ChecklistItem under the Checklist whose ID is <pk> in the API endpoint. """

        # Add a 'Checklist' parameter to the request data (or override it if it exists) to ensure the ChecklistItem
        # being posted is owned by the Checklist whose ID is in the API endpoint URL.
        request.data['checklist'] = '/api/checklists/{}/'.format(pk)

        serializer = ChecklistItemSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=HTTP_201_CREATED)

        return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

    def get_queryset(self):
        """ Only show ChecklistItems which are in Checklists that are owned by the currently
        logged-in user. """
        return ChecklistItem.objects.filter(checklist__owner=self.request.user)


# ----------------------------------------------------------------------------------------------------------------------

class NoteList(ListCreateAPIView):
    """ API endpoint for listing and creating Notes. Requires authentication. """

    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """ Only show Notes which are owned by the currently logged-in user. """
        return Note.objects.filter(owner=self.request.user)

    def post(self, request, *args, **kwargs):
        """ When creating a new Note, only allow the user to create new Notes for themselves. """

        # Get Account detail url for the currently logged-in user. Set that Account url as the data for 'owner'
        # in this request, ignoring what's already there.
        request.data['owner'] = AccountSerializer(request.user, context={'request': request}).data['url']

        # Use the note serializer to build up the notebook, checking for validity, etc
        # If valid, save the object and return a detail-style view along with status 201
        # If invalid, return error messages along with status 400
        note_serializer = NoteSerializer(data=request.data, context={'request': request})
        if note_serializer.is_valid():
            note_serializer.save()
            return Response(note_serializer.data, status=HTTP_201_CREATED)

        return Response(note_serializer.errors, status=HTTP_400_BAD_REQUEST)


class NoteDetail(RetrieveUpdateDestroyAPIView):
    """ API endpoint which allows retrieving details for, updating, or deleting a specific Note. """

    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """ Only show Notes which are owned by the currently logged-in user. """
        return Note.objects.filter(owner=self.request.user)

# ----------------------------------------------------------------------------------------------------------------------

class ChecklistList(ListCreateAPIView):
    """ API endpoint for listing and creating Checklists. Requires authentication. """

    serializer_class = ChecklistSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """ Only show Checklists which are owned by the currently logged-in user. """
        return Checklist.objects.filter(owner=self.request.user)

    def post(self, request, *args, **kwargs):
        """ When creating a new Checklist, only allow the user to create new Checklist for themselves. """

        # Get Account detail url for the currently logged-in user. Set that Account url as the data for 'owner'
        # in this request, ignoring what's already there.
        request.data['owner'] = AccountSerializer(request.user, context={'request': request}).data['url']

        # Use the list serializer to build up the notebook, checking for validity, etc
        # If valid, save the object and return a detail-style view along with status 201
        # If invalid, return error messages along with status 400
        list_serializer = ChecklistSerializer(data=request.data, context={'request': request})
        if list_serializer.is_valid():
            list_serializer.save()
            return Response(list_serializer.data, status=HTTP_201_CREATED)

        return Response(list_serializer.errors, status=HTTP_400_BAD_REQUEST)


class ChecklistDetail(RetrieveUpdateDestroyAPIView):
    """ API endpoint which allows retrieving details for, updating, or deleting a specific Checklist. """

    serializer_class = ChecklistSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """ Only show Checklists which are owned by the currently logged-in user. """
        return Checklist.objects.filter(owner=self.request.user)

# ----------------------------------------------------------------------------------------------------------------------

class ChecklistItemList(ListCreateAPIView):
    """ API endpoint for listing and creating ChecklistItems. Requires authentication. """

    serializer_class = ChecklistItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """ Only show ChecklistItems which are in Checklists that are owned by the currently logged-in user. """
        return ChecklistItem.objects.filter(checklist__owner=self.request.user)


class ChecklistItemDetail(RetrieveUpdateDestroyAPIView):
    """ API endpoint which allows retrieving details for, updating, or deleting a specific ChecklistItem. """

    serializer_class = ChecklistItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """ Only show ChecklistItems which are in Checklists that are owned by the currently logged-in user. """
        return ChecklistItem.objects.filter(checklist__owner=self.request.user)

# ----------------------------------------------------------------------------------------------------------------------

class CategoryList(ListCreateAPIView):
    """ API endpoint for listing and creating Categories. Requires authentication. """

    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """ Only show ChecklistItems which are in Checklists that are owned by the currently logged-in user. """
        return ChecklistItem.objects.filter(checklist__owner=self.request.user)


class ChecklistItemDetail(RetrieveUpdateDestroyAPIView):
    """ API endpoint which allows retrieving details for, updating, or deleting a specific ChecklistItem. """

    serializer_class = ChecklistItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """ Only show ChecklistItems which are in Checklists that are owned by the currently logged-in user. """
        return ChecklistItem.objects.filter(checklist__owner=self.request.user)
