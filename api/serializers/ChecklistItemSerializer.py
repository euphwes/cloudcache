from cloudcache.models import ChecklistItem
from rest_framework.serializers import HyperlinkedModelSerializer

# ----------------------------------------------------------------------------------------------------------------------

class ChecklistItemSerializer(HyperlinkedModelSerializer):
    """ Serializer for read/write actions on the ChecklistItem model list and detail endpoints. """

    class Meta:
        model = ChecklistItem
        fields = ('id', 'text', 'complete', 'checklist', 'created', 'modified', 'url')

        extra_kwargs = {
            'id': {'read_only': True},        # Shouldn't be able to edit ID
        }
