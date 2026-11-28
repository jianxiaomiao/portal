#!/bin/sh
# Generate an isolated, two-day test CA and a server certificate. No trust-store changes.
set -eu
if [ "$#" -ne 2 ]; then
    echo "usage: sh mobile-cert.sh PRIVATE_OR_LOOPBACK_IP NEW_DIRECTORY" >&2
    exit 2
fi
python3 - "$1" <<'PY'
import ipaddress,sys
ip=ipaddress.IPv4Address(sys.argv[1])
if not (ip.is_loopback or any(ip in ipaddress.ip_network(n) for n in
        ("10.0.0.0/8","172.16.0.0/12","192.168.0.0/16"))):
    raise SystemExit("Loopback or private LAN IPv4 required")
PY
umask 077
mkdir "$2"
cd "$2"
cat > extensions.cnf <<EOF
[req]
distinguished_name = name
[name]
[ca]
basicConstraints = critical,CA:TRUE,pathlen:0
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
[server]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = IP:$1
EOF
openssl req -new -x509 -newkey rsa:2048 -nodes -days 2 -sha256 -config extensions.cnf -extensions ca -subj '/CN=Codeville RC temporary test CA' -keyout ca.key -out ca.pem
openssl req -new -newkey rsa:2048 -nodes -sha256 -subj '/CN=Codeville RC preview' -keyout server.key -out server.csr
openssl x509 -req -in server.csr -CA ca.pem -CAkey ca.key -CAcreateserial -days 2 -sha256 -extfile extensions.cnf -extensions server -out server.pem
openssl x509 -in ca.pem -outform der -out phone-ca.cer
openssl x509 -in ca.pem -noout -fingerprint -sha256
