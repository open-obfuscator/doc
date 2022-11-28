+++
title  = "Troubleshooting"
weight = 40
+++

# Troubleshooting

{{< alert type="dark" icon="fa-regular fa-code-merge">}}
Since dProtect is based on Proguard, some questions might be addressed by looking at [Proguard's issues](https://github.com/Guardsquare/proguard/issues)
or Proguard documentation: [Proguard Troubleshooting](https://www.guardsquare.com/manual/troubleshooting/troubleshooting).
{{< /alert >}}


## Gradle Exceptions


{{<troubleshooting problem="issues/warning_ioexception.md" solution="issues/warning_fix.md">}}


## How to open a GitHub issue

If you think that you identified a bug, please, feel free to <br />
open a [GitHub issue]({{< get-var "dprotect.github" >}}/issues) with the following information:


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

###### dProtect Configuration

*You can put the dProtect configuration that triggers the bug (if relevant)*

###### Additional context

*Any other information that could help to address the issue?*

{{< alert type="warning" icon="fa-regular fa-brake-warning">}}
Do not forget to check if a similar issue is open in Proguard's [issues](https://github.com/Guardsquare/proguard/issues).
{{< /alert >}}









