#!/bin/bash

supervisorctl -c /source/openclaw_supervisord.conf start openclaw >> /app/work/logs/bypass/dev.log 2>&1
