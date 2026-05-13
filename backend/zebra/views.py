# SSE streaming view. 
# It receives the image, feeds it through the pipeline generator, 
# and streams each step back as a JSON event:


from django.shortcuts import render

# Create your views here.
import io
import json
import time
from django.http import StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser

from .pipeline import run_pipeline


@api_view(['POST'])
@parser_classes([MultiPartParser])
def process_zebra(request):
    if 'image' not in request.FILES:
        return StreamingHttpResponse(
            _error_stream('No image provided'),
            content_type='text/event-stream'
        )

    # Read uploaded file into memory — nothing touches disk
    image_file = request.FILES['image']
    image_bytes = io.BytesIO(image_file.read())

    response = StreamingHttpResponse(
        _event_stream(image_bytes),
        content_type='text/event-stream'
    )

    # Required headers for SSE
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'  # prevents nginx from buffering the stream

    return response


def _event_stream(image_bytes):
    """
    Iterates through pipeline steps, yielding an SSE event for each.
    Each event carries the step label, a base64 preview image, and progress %.
    """
    try:
        for step in run_pipeline(image_bytes):
            payload = json.dumps(step)
            yield f"data: {payload}\n\n"

            is_result = step.get('result') is not None
            is_error  = step.get('error') is not None

            if not is_result and not is_error:
                # Small sleep for ALL steps, ensures each SSE event arrives
                # as a separate network chunk so React processes them individually.
                # Image steps get a shorter delay since the queue in ProcessingPage
                # handles visual timing independently.
                has_image = step.get('image') is not None
                time.sleep(0.2 if has_image else 1.5)

    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

    finally:
        # Signal to the client that the stream is finished
        yield "data: {\"done\": true}\n\n"


def _error_stream(message):
    yield f"data: {json.dumps({'error': message})}\n\n"
    yield "data: {\"done\": true}\n\n"