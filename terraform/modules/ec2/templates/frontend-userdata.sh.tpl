#!/bin/bash
exec > /var/log/userdata.log 2>&1

apt-get update -y
apt-get install -y git nginx

sudo -u ubuntu git clone ${github_repo_url} /home/ubuntu/AgriConnect
chown -R ubuntu:ubuntu /home/ubuntu/AgriConnect

systemctl enable nginx
systemctl start nginx
