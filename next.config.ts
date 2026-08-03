import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.50.85'],
  // Carbone usa APIs de Node (fs, child_process) y no debe empaquetarse:
  // se deja como dependencia externa del servidor.
  serverExternalPackages: ['carbone'],
};

export default nextConfig;
