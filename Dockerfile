FROM ubuntu:13.10
MAINTAINER Victor Vieux "victorvieux@gmail.com"
RUN apt-get update
RUN apt-get -y install nginx

RUN echo "daemon off;" >> /etc/nginx/nginx.conf
RUN mkdir /etc/nginx/ssl
ADD default /etc/nginx/sites-available/default

ADD . /var/www/

EXPOSE 80

CMD ["nginx"]
