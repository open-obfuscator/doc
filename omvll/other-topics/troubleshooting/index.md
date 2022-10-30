+++
title  = "Troubleshooting"
weight = 10
+++

# Troubleshooting

{{< alert type="warning" icon="fa-brands fa-apple">}}
Be aware that the support for iOS is currently very limited. In particular for Objective-C/Swift code.
{{< /alert >}}

## NDK Specific

{{<troubleshooting problem="issues/libcpp_issue.md" solution="issues/libcpp_fix.md">}}

## Python

{{<troubleshooting problem="issues/python_init_issue.md" solution="issues/python_init_fix.md">}}

{{<troubleshooting problem="issues/config_issue.md" solution="issues/config_fix.md">}}

{{<troubleshooting problem="issues/cmake_error.md" solution="issues/cmake_fix.md">}}

## How to open a GitHub issue

O-MVLL might crash while trying to obfuscate code that is not well supported by the passes, <br />
or it could also introduce an inconsistency in the obfuscated code.

If you think that you identified a bug, please, feel free to <br />
open a [GitHub issue]({{< get-var "omvll.github" >}}) with the following information:

###### Description

*Description of the bug or the problem.*

###### How to reproduce the issue

*Please describe and attach all the necessary <br />
 materials (backtrace, binary, snippet, code) to reproduce the issue.*

{{< alert type="danger" icon="fa-solid fa-spider-black-widow">}}
An issue without enough information to reproduce the problem will be closed without notice.

<br />

If you need to share sensitive information (like code) that could help to address the issue,
<br />
you can use one of these email addresses: <br />

- `ping@obfuscator.re`
- `me@romainthomas.fr`

Here is also a [GPG Key](https://www.romainthomas.fr/EF86C95E.asc).
{{< /alert >}}


###### O-MVLL Python Configuration

*You can put the O-MVLL configuration that triggers the bug (if relevant)*

###### Environment

- Target: Android/iOS?
- O-MVLL Version: `strings libOMVLL.so|grep "OMVLL Version:"`
- Compilation of O-MVLL: CI/By your own

*If you compiled O-MVLL by yourself, please attach the library to the issue.*

###### Additional context

*Any other information that could help to address the issue?*







