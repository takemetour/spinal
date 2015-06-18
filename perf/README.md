# Performance testing
Prepare
```
nf start broker=1,blackman=2
```

Run
```
node case1.js
```

## Result
from Macbook Pro 11'' - 1 broker, 2 nodes
```
requests: 10,000
con-current: 250
total usage: 10,664ms
per transaction: 1.0664 ms
json transaction size: 40609 bytes
total json transfer: 387.28 MB
```