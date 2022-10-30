+++
title       = "Obfuscation Passes"
description = "This section describes how dProtect's passes work and how to use them."
weight      = 20
+++

# Obfuscation Passes

{{< hicon lvl=2 icon="fa-regular fa-user-shield" >}}For Developers{{< /hicon >}}

In the next sections, you can find the documentation of the different obfuscation passes that can be used
to obfuscate Java and Kotlin code.

As for O-MVLL, all the passes are associated with a *Summary Card*, in which the items have the same meaning
as for O-MVLL: [*description*]({{< ref "/omvll/passes" >}}#protection) .

Generally speaking, the obfuscation passes come with a dedicated option that must be added to the `.pro` file
of the project:

```bash
-obfuscation-pass <description>
```

{{< alert type="info" icon="fa-regular fa-lightbulb-on" >}}
Since dProtect is based on Proguard, the original options in the `.pro` are supported by dProtect.
{{< /alert >}}

Some obfuscation passes can also be tweaked by adding *modifiers*:

```bash
-obfuscation-pass,mod1,mod2 <description>
```

These modifiers are not extensively used by the obfuscation passes but future versions of
dProtect will start to introduce these modifiers. Those modifiers will help to provide a better granularity over
which parts of the code need to be obfuscated and how.

One can access the complete list of the obfuscation passes and their syntax in the
[cheat sheet]({{< ref "/dprotect/introduction/cheat-sheet" >}}) section.

{{< hicon lvl=2 icon="fa-solid fa-user-ninja" >}}For Reverse Engineers{{< /hicon >}}

As for the O-MVLL passes, **none** of these obfuscation passes is "unbreakable".

I also think that we could use the Proguard/ProguardCORE's functionalities
to **statically** deobfuscate some of these passes. The code of
[XoredStrings.java]({{< get-var "dprotect.github" >}}/blob/main/base/src/main/java/dprotect/deobfuscation/strings/XoredStrings.java)
can be a starting point for creating deobfuscation passes.

It would be great to challenge the passes implemented in dProtect to determine their level of resilience
against reverse engineering.
All the results -- and their countermeasures -- will be referenced in the associated sections.

{{< alert type="success" icon="fa-brands fa-android" >}}
Recently, ProguardCORE welcomed an interface to process the Dalvik bytecode (i.e. DEX files) through dex2jar:
https://github.com/Guardsquare/proguard-core/pull/47/<br /><br />

This feature could ease the support of closed-source APK.
{{< /alert >}}



