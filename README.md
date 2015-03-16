# ReNodeCache
NodeJS Caching layer for websites, that caches full page html in Redis.

Application trys to server page from redis, if cache is empty it ases from real-website and cahces it into redis.
Tune these settings for your needs.

### Settings
This setting controls, how often app should check to see if cache build is finished.
Set this parameter, depending on the response time of underlayin website you want to cache.
__SETTINGS['CACHE_RECHECK_TIMEOUT'] = 30; //miliseconds

Skip this for now
__SETTINGS['CACHE_REBUILD_ARRAY_MAX_SIZE'] = 5000; //entries of array

Print stats about requests / per second every N requests.
__SETTINGS['CALC_RPS_EACH_N_REQUESTS'] = 300; //print stats each 300 requests

How long to keep the page in the Redis cache (seconds)
__SETTINGS['PAGE_EXPIRE_SECONDS'] = 100;


--------------------------
###Front Nginx configuration, if you decide to put nodejs under nginx reverse proxy.
This is an example configuration file for nginx, that acts as a reverse proxy and serves statis content (photos, js, css).
The rest is passed to ReNodeCache application (NodeJS).

REAL_ADDRESS_OF_THE_WEBSITE  - Ip address of the website we cache
DOMAIN - website domain to respond to.

```
server {
	server_name  DOMAIN;
	listen   80; ## listen for ipv4; this line is default and implied

        #access_log  /var/log/nginx/DOMAIN-access.log;
        #error_log   /var/log/nginx/DOMAIN-error.log;

        location  ~* \.(?:css|ico|js|gif|jpe?g|png)$ {
	    proxy_pass	       http://REAL_ADDRESS_OF_THE_WEBSITE;
            proxy_read_timeout 180s;
            proxy_send_timeout 180s;
            proxy_set_header   X-Real-IP        $remote_addr;
            proxy_set_header   Host             $host;
            proxy_set_header   X-Forwarded-For  $remote_addr;
        }

	location / {
            proxy_pass         http://localhost:8888;
            proxy_read_timeout 180s;
            proxy_send_timeout 180s;
            proxy_set_header   X-Real-IP        $remote_addr;
            proxy_set_header   Host             $host;
            proxy_set_header   X-Forwarded-For  $remote_addr;	    
	}
}
```
