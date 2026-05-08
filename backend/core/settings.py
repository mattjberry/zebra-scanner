from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

# ── Security ──────────────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'dev-secret-change-me')
DEBUG      = os.environ.get('DEBUG', 'True') == 'True'
ALLOWED_HOSTS = ['*']  # tighten for production

# ── Applications ──────────────────────────────────────────────────────────────
# Stripped to minimum — no auth, sessions, or admin since we have no database
# and no user accounts
INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'corsheaders',
    # Local
    'zebra',
]

# ── Middleware ────────────────────────────────────────────────────────────────
# Must match INSTALLED_APPS — every middleware here requires its corresponding
# app to be present. The default startproject list includes auth/session/message
# middleware which we've removed because those apps aren't installed.
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',       # must be first
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',  # Vite dev server
]

# ── URLs / WSGI ───────────────────────────────────────────────────────────────
ROOT_URLCONF      = 'core.urls'
WSGI_APPLICATION  = 'core.wsgi.application'

# ── Database ──────────────────────────────────────────────────────────────────
# Explicitly empty — stateless pipeline, nothing is persisted
DATABASES = {}

# ── File uploads ──────────────────────────────────────────────────────────────
# Images are handled in memory — these limits protect against oversized uploads
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024   # 10MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024   # 10MB

# ── Django REST Framework ─────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [],   # no auth schemes
    'DEFAULT_PERMISSION_CLASSES': [],       # no permission checks
    'UNAUTHENTICATED_USER': None,
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.MultiPartParser',  # required for image uploads
        'rest_framework.parsers.JSONParser',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
}

# ── Templates ─────────────────────────────────────────────────────────────────
# Minimal — only needed for Django's own dev error pages
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
            ],
        },
    },
]

# ── Static files ──────────────────────────────────────────────────────────────
STATIC_URL = 'static/'

# ── Internationalisation ──────────────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE     = 'UTC'
USE_I18N      = False
USE_TZ        = True