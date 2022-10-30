+++
title = "Introduction"
weight = 10
+++

# Introduction

Welcome to the O-MVLL documentation. This documentation is split into three sections:

1. This first section, *Introduction*, is about how to use and how to get started with O-MVLL.

2. The second section, [obfuscation passes]({{< ref "/omvll/passes" >}}), describes
   the different obfuscation passes available in O-MVLL.

3. The last section, [other topics]({{< ref "/omvll/other-topics" >}}), contains different information
   for those who are already familiar with the project.

O-MVLL is an obfuscator based on LLVM that uses the new LLVM pass manager, `-fpass-plugin` to perform
native code obfuscation. These obfuscation rules are driven by a Python API defined as follows:

{{< alert type="danger" icon="fa-light fa-microchip">}}
O-MVLL only supports and will only support the **AArch64 architecture**. This is a design choice.
{{</ alert >}}

```python
import omvll

class MyConfig(omvll.ObfuscationConfig):
    def __init__(self):
        super().__init__()

    def flatten_cfg(self, mod: omvll.Module, func: omvll.Function):
        if func.name == "check_password":
            return True
        return False
    def obfuscate_string(self, _, __, string: bytes):
        if string.startswith(b"/home") and string.endswith(b".cpp"):
          return "REDACTED"
```



{{< svg "/assets/omvll/omvll-pipeline.svg" >}}

