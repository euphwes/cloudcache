from django.conf.urls import url

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse

from .views.public import AccountList, AccountDetail, NotebookList, NotebookDetail

# ----------------------------------------------------------------------------------------------------------------------

@api_view(('GET',))
def api_root(request, format=None):
    """ Main entry point for the API. """

    return Response({
        'accounts': reverse('account-list', request=request, format=format),
        'notebooks': reverse('notebook-list', request=request, format=format),
    })

# ----------------------------------------------------------------------------------------------------------------------

urlpatterns = [
    # API root
    url(r'^$', api_root),

    # authentication.models.Account list and detail views
    url(r'^accounts/$', AccountList.as_view(), name='account-list'),
    url(r'^accounts/(?P<pk>[0-9]+)/$', AccountDetail.as_view(), name='account-detail'),

    # cloudcache.models.Notebook list and detail views
    url(r'^notebooks/$', NotebookList.as_view(), name='notebook-list'),
    url(r'^notebooks/(?P<pk>[0-9]+)/$', NotebookDetail.as_view(), name='notebook-detail'),
]
