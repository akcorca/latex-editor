FROM ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive

# Install texlive + python + build tools
# Ubuntu 20.04 has TexLive 2019 (pdfTeX 1.40.20) with l3backend-pdfmode.def (2020-02-03)
# The repo's pre-built format uses pdfTeX 1.40.21 with L3 layer <2020-02-14>
# Ubuntu 20.04's l3backend (2020-02-03) has NO version check, so it works fine
RUN apt-get update && apt-get install -q -y \
    wget \
    texlive-full \
    python3 \
    python3-pip \
    python3-dev \
    libkpathsea-dev \
    git \
  && rm -rf /var/lib/apt/lists/*

# Clone Texlive-Ondemand (for C source + pre-built format file)
# The repo's format file was built by pdfTeX 1.40.21 (matching the WASM binary)
# DO NOT rebuild the format — Ubuntu 20.04's pdfTeX 1.40.20 produces an incompatible one
RUN git clone https://github.com/SwiftLaTeX/Texlive-Ondemand.git /app

WORKDIR /app

# Install Python deps (pin gevent for Python 3.8 compat, install Cython for arm64 build)
RUN pip3 install --upgrade pip setuptools wheel Cython \
  && pip3 install flask 'gevent==21.12.0' flask-cors

# Build kpathsea C extension for pdftex
RUN python3 kpathsea_pdftex_setup.py build_ext --inplace

# Override app.py/wsgi.py with our patched versions (xetex removed)
COPY app.py wsgi.py /app/

EXPOSE 5001

CMD ["python3", "wsgi.py"]
