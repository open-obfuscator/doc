+++
title       = "Introduction"
description = "An introduction to dProtect"
weight      = 10
+++

# Welcome

Welcome to the documentation of `dProtect`, an Android bytecode obfuscator based on Proguard.

This documentation details the obfuscation passes implemented in dProtect as well as their inner design.
You will also find information about how to integrate dProtect into an Android project and
the different steps to modify or add new obfuscation passes.

{{< svg "/assets/dprotect/dprotect-pipeline.svg" "mb-4">}}

{{< alert type="dark" title="dProtect vs Proguard">}}
`dProtect` is an extension of Proguard and ProguardCORE, two open-source projects developed by Guardsquare.<br /><br />

dProtect extends Proguard by adding an enhanced obfuscation pipeline. This new pipeline extensively
relies on the great software engineering design behind Proguard and ProguardCORE.<br /><br />

As for LLVM, the design of Proguard and ProguardCORE is such that extending or adding new features is very
easy. Hence, most of the credit for this project goes to Proguard's developers.
{{</ alert >}}

