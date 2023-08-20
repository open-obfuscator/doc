+++
headless = true

[_build]
  list = 'never'
  render = 'never'
+++

The objective of this challenge is to find the correct login/password that leads to **"Access Granted"**.

The given Android application is protected with different layers of protections (obfuscation, RASP checks, ELF modifications)
but the **design** of all these protections is **public**:

- Code obfuscation is provided by O-MVLL/dProtect.
- The RASP checks are publicly known and documented on the internet.
- The ELF format modifications are described here: [The Poor Man's Obfuscator](https://www.romainthomas.fr/publication/22-pst-the-poor-mans-obfuscator/).
- All the algorithms used in the challenge are public.

As obfuscation is a matter of time, the first prize of this challenge will be eligible for <u>6 months</u>.
During this period, the first person to find the correct login/password will be able to choose between a BinaryNinja license
or a cash prize of 1300$/€.

The second prize will reward the write-up quality. This second prize will be the one that has not been
chosen in the first part (if any). It will last for 3 months more after the end of the first part.
So in total, this challenge is running for **9 months**.

If you have found the flag or if you want to submit a write-up, you can send an email to this address:
challenge-pydroid@obfuscator.re. If you have any questions, you can reach out at this address: ping@obfuscator.re or join the
Discord server at this address: [{{< get-var "discord" >}}]({{< get-var "discord" >}}).

The list of the participants who found the flag or submitted a write-up will be updated in the section below and
you can find the details of the rules in this document: [Rules_Description.pdf](/challenges/2022-12-android-challenge/Rules_Description.pdf).

Happy reverse engineering!

----

<br />

Checksum of the APK: `a0b07e97197e2dfe48bb7df65dba4f145d485660ecf4bd0d3ab65b14039ec8d6`
