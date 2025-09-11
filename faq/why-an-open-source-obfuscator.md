+++
title           = "Why an open-source obfuscator?"
headless        = true
sitemap_exclude = true
weight          = 20
+++

From a personal standpoint, I really do believe that an open-source design
does not -- if wisely thought and used -- weaken the overall protection against reverse engineering.
Said differently, I believe that we can reach a good level of protection against reverse engineering
even though the design is known.

Basically, obfuscation passes introduce overhead for the reverse engineering process but it is not
an absolute protection.
If this overhead is too high, the attacker could timeout or find a way to
automate and potentially scale the deobfuscation process.
The automation and the scalability of the deobfuscation could be mitigated in the design of the obfuscation.

In its current version, the design of the passes in O-MVLL and dProtect can be improved in a lot of ways,
but at least the project is **bootstrapped**, **documented**, and **open source**.

I also do hope that the [challenges]({{< ref "/challenges" >}}) are a good opportunity to assess and publish
attacks on O-MVLL and dProtect which could be a benefit for both: reverse engineering and obfuscation.


