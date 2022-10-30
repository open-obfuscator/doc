+++
title       = "Obfuscation Passes"
description = "Description of the passes available in O-MVLL"
weight      = 20
+++

# Obfuscation Passes

{{< hicon lvl=2 icon="fa-regular fa-user-shield" >}}For Developers{{< /hicon >}}

The items in this section describe the different obfuscation passes available in O-MVLL.
The documentation of the passes provides information about when and how to use the obfuscation as well as
its limitations.

There is also an overview of the pass synthesized by the following items:

##### Protection

- **Static**: the pass aims at protecting against static code analysis (decompilation, disassemblers, ...)
- **Dynamic**: the pass aims at protecting against dynamic code analysis (hooking, instrumentation, debugging, ...)

##### Resilience

This property tries to give a level of strength against a fully automated attack. If such an attack exists,
it is mentioned in the *References* section of the pass.

##### Obfuscation Overhead

The kind of overhead introduced in the program when using the given obfuscation pass. The values can be:

- **Code size**: the assembly code is larger.
- **Data size**: the raw data of the binary is larger.
- **Memory size**: the size of the binary in memory is larger [^bss_vs_data].
- **Execution**: the execution can be slowed down.

##### Public Attacks

Whether it exists public attacks that could be applied to the current obfuscation. It is important to mention
that, even though an attack could exist, it does not necessarily mean that
the attack scale, and could be blindly applied to the protected binary.

{{< hicon lvl=2 icon="fa-solid fa-user-ninja" >}}For Reverse Engineers{{< /hicon >}}

First and foremost, **none** of these obfuscation passes is "unbreakable". That being said, we warmly welcome
new attacks on these obfuscation techniques that could result in a complete **scalable** *deobfuscation*.

For instance, we know that simple mixed boolean-arithmetic expressions (MBA) can be simplified with open-source
tools like [mrphrazer/msynth](https://github.com/mrphrazer/msynth). Thus, given the [Arithmetic Obfuscation]({{< ref "/omvll/passes/arithmetic" >}}) pass
applied to several *real* functions, could we manage to identify and create a pipeline to simplify the expressions?

If there is a new way to address this problem, we will love to reference this work in the associated documentation.
If there also is an idea to circumvent your attack, feel free to open a PR or an issue that describes this
idea.

[^bss_vs_data]: Uninitialized static values do not take space in the binary (`.bss`) compared to initialized values (`.data`).
                That's why this item differs from *Data size*.
