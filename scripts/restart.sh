#!/bin/bash

supervisorctl -c /source/openclaw_supervisord.conf restart openclaw >> /app/work/logs/bypass/dev.log 2>&1
