+++
title = "Writeup by Robert Bo Xiao"
type = "writeups"
authors = ["Robert Xiao"]
+++

## Writeup for obfuscator.re Challenge 1

Author: Robert Xiao [nneonneo@gmail.com](mailto:nneonneo@gmail.com)

We're provided an APK file, and told that it has been protected by O-MVLL (native code), dProtect (dex code), ELF format modifications, and runtime application self protection (RASP). Let's dive in!

Our first stop is to unzip the APK. There's a single native library, `lib/arm64-v8a/liba1re03.so` weighing in at 27MB, along with bits of Kotlin data suggesting that parts of the app are written in Kotlin.

I didn't bother to install or run this app in any way; most of my reversing is done statically.

### Java/Kotlin code

We can use JADX to inspect the Dalvik (dex) code and the AndroidManifest.xml. The code decompiles mostly fine (no bytecode-level tampering), but class and method names are obfuscated (as expected) and strings and numbers are encrypted.

There's a ton of obfuscated classes in the anonymous package, most of which seem to correspond to bits of Kotlin code. Luckily, the really interesting stuff is all in the `re.obfuscator.challenge01` package.

From AndroidManifest.xml, we see that the main application class is `re.obfuscator.challenge01.AHGILuuQdMj` and the main activity is `re.obfuscator.challenge01.sTxUFmGsNP`; we can rename them to `MainApplication` and `MainActivity` respectively. From `res/navigation/nav_graph.xml`, we see that `re.obfuscator.challenge01.XBuUyhhspa` corresponds to `FirstFragment`, `re.obfuscator.challenge01.LvfvlwOEfOn` to `SecondFragment`, and `re.obfuscator.challenge01.VCyPLJeiyfu` to `Validate`; we can rename these accordingly.

`Validate` (`VCyPLJeiyfu`) contains the only native method, `public final native boolean PGPyIMEWUxFr(String str);`. We see that it is called as follows:

```java
validate.aLO().aLB().mo1567aj(validate.aLN().etC.getText().toString());
validate.aLO().aLC().mo1567aj(Boolean.valueOf(validate.PGPyIMEWUxFr(validate.aLO().aLE())));
```

`aLE` appears to gather some values, presumably the login and password, and then creates a `cfb` object:

```java
return m13766a.m13833bf(new cfb(str, value3, ((int) esT[0]) ^ 2122205795));
```

There's only one other reference to `cfb` in the code, in the function `List<String> yakKojVORPA.toJson(cfb cfbVar)`. It calls `cev.m6193dh` on each of the `cfb` data elements, which in turn calls `Base64.encodeToString`. So, we can guess that the login and password are base64-encoded, put into a list and JSON-encoded, and then fed to the native function to validate the input. Knowing the input, we can now turn our attention to the native code.

### Native code

`liba1re03.so` is quite large. Since we suspect the ELF headers have been tampered with, the first step is to fix them using a little script I wrote: [`rebuild_elf_sections.py`](https://github.com/nneonneo/pwn-stuff/blob/master/rev/rebuild_elf_sections.py). This script basically builds brand-new ELF section headers based on the result of parsing the segment headers and DYNAMIC segment.

The resulting binary loads just fine into Ghidra. We see a ton of garbage function references - these are the "fake exports" mentioned in the poor man's obfuscator talk. It's easy to just delete them in Ghidra - the fake symbols are all at odd addresses, which is impossible for AARCH64.

There are two relevant bits of code: the initialization functions from `.init_array`, called when the library is loaded, and the `JNI_OnLoad` function, called from `System.loadLibrary` in Java.

There are a total of 13 `init_array` functions, which I named `init_0` through `init_12`. At a glance, `init_0` through `init_8` (except `init_5`) are just performing string decryption. `init_5` is more complex; Ghidra decompiles it as follows:

```c
void init_5(void)
{
  undefined *puVar1;
  ulong uVar2;
  long lVar3;
  undefined *puVar4;
  ulong uVar5;
  ulong uVar6;
  undefined auStack_40 [16];
  undefined *local_30;
  code *local_28;
  undefined8 ****local_20 [2];

  local_20[0] = local_20 + 1;
  local_30 = &DAT_00308cc4;
  uVar6 = (ulong)local_20[0] | (ulong)local_20;
  uVar2 = ((ulong)local_20[0] & (ulong)local_20) + uVar6;
  uVar5 = (long)local_20[0] + (long)local_20;
  uVar6 = ~uVar5 + uVar6;
  uVar6 = ((uVar2 | 1) & uVar6) + (uVar2 | 1 | uVar6);
  uVar5 += ~(ulong)local_20[0] | (ulong)local_20 ^ 0xffffffffffffffff;
  lVar3 = (uVar5 ^ uVar2 ^ 0xffffffffffffffff) + (uVar2 & (uVar5 ^ 0xffffffffffffffff)) * 2;
  uVar2 = -lVar3;
  uVar5 = uVar6 | uVar2;
  uVar2 = uVar5 - (uVar6 & uVar2);
  lVar3 = (uVar6 - lVar3) - uVar5;
  uVar2 = ((uVar2 & lVar3 * 2) + (uVar2 | lVar3 * 2)) - ((ulong)local_20[0] ^ (ulong)local_20);
  puVar4 = &DAT_00308cc4 + (uVar2 - (uVar2 | 0x308cc4));
  puVar1 = &DAT_00308cc4 + (uVar2 ^ 0xffffffffffffffff | 0xffffffffffcf733b) + uVar2 + 1;
  uVar2 = ((ulong)puVar4 & (ulong)puVar1) + ((ulong)puVar4 | (ulong)puVar1);
  DAT_019f60c8 = 0x12;
  local_20[1] = (undefined8 ****)0xe;
  uVar6 = (uVar2 + 0x20) - (uVar2 | 0x20);
  uVar2 = uVar2 + 0x20 + (~uVar2 | 0xffffffffffffffdf) + 1;
  local_28 = (code *)((uVar6 & uVar2) + (uVar6 | uVar2));
  (*local_28)();
  return;
}
```
<br />

I recognize this as the [control-flow breaking](https://obfuscator.re/omvll/passes/control-flow-breaking/) pass from O-MVLL: this is a wrapper which uses opaque constants derived from the stack pointer to obfuscate the real address of the function (called at the end via `local_28`). The code uses the low bits of `sp`, which are always zero due to stack alignment, resulting in a constant result. However, since the decompiler does not make this assumption, it outputs the raw (obfuscated) calculations.

Luckily, I have a trick: using `Set Register Values...` in Ghidra, we can just set `sp` to a concrete value (say, 0x7fff000b0000) at the start of the function, and Ghidra's constant propagation will do the rest:

```c
// WARNING: This function may have set the stack pointer

void init_5(void)

{
  undefined8 unaff_x30;

  uRam00007fff000affe0 = 0x7fff000affe8;
  puRam00007fff000affd0 = &DAT_00308cc4;
  DAT_019f60c8 = 0x12;
  uRam00007fff000affe8 = 0xe;
  pcRam00007fff000affd8 = FUN_00308ce4;
  uRam00007fff000afff0 = unaff_x30;
  FUN_00308ce4();
  return;
}
```
<br />

Note that I also added 0x7fff... to the memory map (Window -> Memory Map) so that stack references would still work. Now, it's trivial to identify the real function (`FUN_00308ce4`) and decompile it to find another string decryption routine.

We can use emulation to recover the decrypted strings. I wrote a little script that uses the Unicorn engine to call functions from the binary. Note that Ghidra loads using a base address of 0x100000, but I don't want to handle relocations, so I just load at address 0:

```python
from unicorn import *
from unicorn.arm64_const import *
import lief

uc = Uc(UC_ARCH_ARM64, UC_MODE_ARM)
STACK_TOP = 0x7fff_ffff_0000
END_ADDR = 0xffff_ffff_ffff_f000
# stack
uc.mem_map(STACK_TOP - 0x100000, 0x101000, UC_PROT_READ|UC_PROT_WRITE)
# return page
uc.mem_map(END_ADDR, 0x1000, UC_PROT_EXEC)

def align_down(addr: int, align: int = 4096) -> int:
    return addr // align * align

def align_up(addr: int, align: int = 4096) -> int:
    return (addr + align - 1) // align * align

def elf_prot_to_uc(prot: lief.ELF.SEGMENT_FLAGS) -> int:
    res = 0
    if prot & lief.ELF.SEGMENT_FLAGS.R:
        res |= UC_PROT_READ
    if prot & lief.ELF.SEGMENT_FLAGS.W:
        res |= UC_PROT_WRITE
    if prot & lief.ELF.SEGMENT_FLAGS.X:
        res |= UC_PROT_EXEC
    return res

def load_elf(uc, filename):
    f = lief.parse(filename)
    for seg in f.segments:
        if seg.type == lief.ELF.SEGMENT_TYPES.LOAD:
            page_start = align_down(seg.virtual_address)
            page_end = align_up(seg.virtual_address + seg.virtual_size)
            uc.mem_map(page_start, page_end - page_start, elf_prot_to_uc(seg.flags))
            if seg.content:
                uc.mem_write(seg.virtual_address, bytes(seg.content))

def call_func(uc, addr):
    uc.reg_write(UC_ARM64_REG_SP, STACK_TOP)
    uc.reg_write(UC_ARM64_REG_LR, END_ADDR)
    uc.emu_start(addr, END_ADDR)

def rreg(name):
    return uc.reg_read(globals()["UC_ARM64_REG_" + name.upper()])

def rstr(addr):
    res = bytearray()
    while 1:
        b = uc.mem_read(addr, 1)
        if b == b"\x00":
            break
        res += b
        addr += 1
    return res

load_elf(uc, "liba1re03.so")
call_func(uc, 0x1c2004)
print(uc.mem_read(0x4481f0, 9))
call_func(uc, 0x1cda30)
print(uc.mem_read(0x4481f9, 9))
call_func(uc, 0x1cdc70)
print(uc.mem_read(0x448201, 0x50d))
call_func(uc, 0x1cd628)
print(uc.mem_read(0x44870e, 7))
call_func(uc, 0x1de9d4)
print(uc.mem_read(0x448778, 0x212))
call_func(uc, 0x2021a4)
print(uc.mem_read(0x44898a, 16))
call_func(uc, 0x202720)
print(uc.mem_read(0x44899a, 0x1a))
call_func(uc, 0x201540)
print(uc.mem_read(0x4489b4, 8))
call_func(uc, 0x1ff984)
print(uc.mem_read(0x4489bc, 0x1a))
```
<br />

This gives us the following strings:

```
bytearray(b'__FLAG__\x00')
bytearray(b'__doc__\x00\x9b')
bytearray(b'\n    700d0d0a000000004aaf626335010000e300000000000000000000000000000000040000004\n    00000007338000000640064016d005a00640064016d015a0164026502640365036604640464\n    0583045a04640265026403650366046406640783045a05640153002908e9000000004eda046\n    4617461da0672657475726e6301000000000000000000000003000000040000004300000073\n    3a0000007400a1017d00a2015c027c017c027402a1037d01a2017c017402a1037d02a2017c0\n    27402a1047d017d021800a201a105a20074026a066b02530029014e2907da046a736f6eda05\n    6c6f616473da07616e64726f6964da066465636f6465da0e5f5f6f6266757363617465645f5\n    fda03686578da075f5f646f635f5f290372020000005a056c6f67696eda0870617373776f72\n    64a900720c000000fa502f686f6d652f726f6d61696e2f6465762f6f70656e2d6f626675736\n    361746f722f6368616c6c656e67652f6368616c6c656e67652d30312f736372697074732f65\n    787472612f636865636b65722e7079da05636865636b0400000073080000000e010a010a011\n    801720e00000063010000000000000000000000010000000200000043000000730c00000074\n    007d00840164016b02530029024e72010000002901da036c656e29017202000000720c00000\n    0720c000000720d000000da067665726966790a00000073020000000c017210000000290672\n    060000007204000000da03737472da04626f6f6c720e0000007210000000720c000000720c0\n    00000720c000000720d000000da083c6d6f64756c653e010000007308000000080008011202\n    1606\n  \x00')
bytearray(b'__bc__\x00')
bytearray(b'\n      import android\n      from android import decode, hash\n      import json\n      data = json.loads(json_data)\n      login, password = data\n\n      login    = decode(login)\n      password = decode(password)\n\n      flag = login + password\n      h = hash(flag).hex()\n      if h != android.__FLAG__:\n        android.print("Humm it looks like, it\'s not the good flag ...")\n        android.print("It should be {} while it is {}".format(android.__FLAG__, h))\n      else:\n        android.print("Well done!")\n        is_valid = True\n  \x00')
bytearray(b'/proc/self/task\x00')
bytearray(b'/proc/self/task/{}/status\x00')
bytearray(b'libc.so\x00')
bytearray(b'__system_property_foreach\x00')
```
<br />

Looks like Python code! This would explain why the binary is so huge. Let's take a detour to look at the Python bits...

### Embedded Python bits

A Python interpreter means the Python stdlib must be present. Since there's no Python stuff in the APK, the stdlib is probably packed in the binary. Indeed, at offset 0x4469E0, we can find a ZIP header (`PK\3\4`). Extracting this, we get a 21.5 MB ZIP file containing the entire Python 3.10 standard library. We also get a few extra files of interest:

- `_sysconfigdata__linux_aarch64-linux-android.py`: shows the full configuration of the build, including file paths
- `pyloader.py`: not part of the Python standard lib, contains the following code:
```python
import importlib
from importlib.machinery import SourcelessFileLoader
from importlib.util import spec_from_file_location
import sys
import android

class FileLoader(SourcelessFileLoader):
    def __init__(self):
        super().__init__("checker", "checker.cpython-310.pyc")

    def get_data(self, path: str):
        return bytes.fromhex(android.__bc__.replace("\n", "").strip().replace(" ", ""))


def import_checker():
    loader = FileLoader()
    spec = spec_from_file_location('checker', "checker.cpython-310.pyc",
                                    loader=loader)
    module = importlib._bootstrap._load(spec)
    sys.modules['checker'] = module
    return module
```

<br />

- `config-3.10`: a directory containing lots of Python build artifacts, including `config.c`, `Makefile`, `Setup`, `libpython3.10.a` and `python.o`.

The inclusion of `config-3.10` is strange, and very pointless: `libpython3.10.a` is *huge* (23.6 MB) and completely unnecessary at runtime, plus it contains symbols for the entire Python standard library. We can take advantage of it: by compiling `python.o` with `libpython3.10.a`, we get a binary with all of the Python symbols:

`aarch64-linux-android-gcc python.o -l python3.10 -o python.elf --sysroot=${NDK_HOME}/platforms/android-24/arch-arm64 -L. -lm`

I loaded this binary into Ghidra, then used the Version Tracker (a bindiff-like tool) to apply all of the symbols to `liba1re03.so`, thereby allowing me to see proper symbols for pretty much the entire Python interpreter. I also imported all of the data types from the libpython DWARF.

`pyloader.py` is also pretty interesting. It suggests that the real checker function is loaded from the `__bc__` constant, which is referred to in our decrypted strings above. We'll revisit this soon.

### Returning to the native binary

`init_9` looks like it's setting up some kind of thread, maybe a security mechanism. I ignored it. `init_10` just calls `__cxa_atexit`, and `init_12` is checking to see if the CPU has LSE atomics (`__aarch64_have_lse_atomics`).

`init_11` is more interesting. From the strings it uses and our recovered Python interpreter symbols, we can see that it's defining a `pybind11` extension module named `android`. The main function is `FUN_002c35d8`; this is a long function with a lot of inlined string decryption junk. Again, I chose to just run this in Unicorn, after working out what functions it calls:

```python
# pybind11_init_android
uc.reg_write(UC_ARM64_REG_SP, STACK_TOP)
uc.reg_write(UC_ARM64_REG_LR, END_ADDR)
def hook_code(uc, addr, sz, userdata):
    pc = uc.reg_read(UC_ARM64_REG_PC)
    if not 0x1c35d8 <= pc < 0x1cd318:
        if pc == END_ADDR:
            uc.emu_stop()
        elif pc == 0x164888:
            print(f"str({rreg('x0'):#x}, {rstr(rreg('x1')).decode()!r})")
        elif pc == 0x180c08:
            print(f"str_attr_accessor({rreg('x8'):#x}, {rreg('x0'):#x}, {rstr(rreg('x1')).decode()!r})")
        elif pc == 0x1bfa48:
            print(f"str_attr_accessor::=({rreg('x0'):#x}, {rreg('x1'):#x})")
        elif pc == 0x1a6e18:
            print(f"~str_attr_accessor({rreg('x0'):#x})")
        elif pc == 0x1ab018:
            print(f"~str({rreg('x0'):#x})")
        elif pc == 0x1c22b0:
            print(f"0x1c22b0({rreg('x0'):#x}, {rstr(rreg('x1')).decode()!r}, {rreg('x2'):#x})")
        elif pc == 0x1c2438:
            print(f"0x1c2438({rreg('x0'):#x}, {rstr(rreg('x1')).decode()!r}, {rreg('x2'):#x})")
        elif pc == 0x1c316c:
            print(f"0x1c316c({rreg('x0'):#x}, {rstr(rreg('x1')).decode()!r}, {rreg('x2'):#x})")
        elif pc == 0x1c2730:
            print(f"0x1c2730({rreg('x0'):#x}, {rstr(rreg('x1')).decode()!r}, {rreg('x2'):#x})")
        else:
            print(hex(pc), hex(uc.reg_read(UC_ARM64_REG_X0)), hex(uc.reg_read(UC_ARM64_REG_X1)))

        uc.reg_write(UC_ARM64_REG_PC, uc.reg_read(UC_ARM64_REG_LR))

hook = uc.hook_add(UC_HOOK_CODE, hook_code, None, 0, 0xffffffff)

uc.emu_start(0x1c35d8, 0x1cd318)

uc.hook_del(hook)
```
<br />

This is quite helpful. We get lots of information:

```
str(0x7ffffffefeb8, 'f5ca458deb9629a74d4b0c3669deb5078a6a85a90afba9a3c76f5306a4bafb06')
str_attr_accessor(0x7ffffffeff70, 0x0, '__FLAG__')
str_attr_accessor::=(0x7ffffffeff70, 0x7ffffffefeb8)
~str_attr_accessor(0x7ffffffeff70)
~str(0x7ffffffefeb8)
str(0x7ffffffefeb0, '9c16a9c3017d2b3876323bc4f9dad2b7530c')
str_attr_accessor(0x7ffffffeff50, 0x0, '__doc__')
str_attr_accessor::=(0x7ffffffeff50, 0x7ffffffefeb0)
~str_attr_accessor(0x7ffffffeff50)
~str(0x7ffffffefeb0)
str(0x7ffffffefea8, '\n    700d0d0a000000004aaf626335010000e300000000000000000000000000000000040000004\n    00000007338000000640064016d005a00640064016d015a0164026502640365036604640464\n    0583045a04640265026403650366046406640783045a05640153002908e9000000004eda046\n    4617461da0672657475726e6301000000000000000000000003000000040000004300000073\n    3a0000007400a1017d00a2015c027c017c027402a1037d01a2017c017402a1037d02a2017c0\n    27402a1047d017d021800a201a105a20074026a066b02530029014e2907da046a736f6eda05\n    6c6f616473da07616e64726f6964da066465636f6465da0e5f5f6f6266757363617465645f5\n    fda03686578da075f5f646f635f5f290372020000005a056c6f67696eda0870617373776f72\n    64a900720c000000fa502f686f6d652f726f6d61696e2f6465762f6f70656e2d6f626675736\n    361746f722f6368616c6c656e67652f6368616c6c656e67652d30312f736372697074732f65\n    787472612f636865636b65722e7079da05636865636b0400000073080000000e010a010a011\n    801720e00000063010000000000000000000000010000000200000043000000730c00000074\n    007d00840164016b02530029024e72010000002901da036c656e29017202000000720c00000\n    0720c000000720d000000da067665726966790a00000073020000000c017210000000290672\n    060000007204000000da03737472da04626f6f6c720e0000007210000000720c000000720c0\n    00000720c000000720d000000da083c6d6f64756c653e010000007308000000080008011202\n    1606\n  ')
str_attr_accessor(0x7ffffffeff30, 0x0, '__bc__')
str_attr_accessor::=(0x7ffffffeff30, 0x7ffffffefea8)
~str_attr_accessor(0x7ffffffeff30)
~str(0x7ffffffefea8)
0x1c22b0(0x0, 'print', 0x7ffffffefea0)
0x1c2438(0x0, 'MvtKNJXCOGJe', 0x1c32e0)
0x1c316c(0x0, 'decode', 0x1c2640)
0x1c2730(0x0, 'hash', 0x7ffffffefe98)
```
<br />

From this, we can tell what the `android` module looks like:

- `__FLAG__ = "f5ca458deb9629a74d4b0c3669deb5078a6a85a90afba9a3c76f5306a4bafb06"`
- `__doc__ = "9c16a9c3017d2b3876323bc4f9dad2b7530c"`
- `__bc__ = "\n    700d0d0a000000004aaf626335010000e300000..."`
- `print = ?`
- `hash = ?`
- `MvtKNJXCOGJe = native function at 0x1c32e0`
- `decode = native function at 0x1c2640`

Finally, we have `JNI_OnLoad`. The function is another obfuscated wrapper, which we can fix by setting `sp`. The real `JNI_OnLoad` is obfuscated using control-flow flattening and more opaque constants; setting `sp` fixes the latter issue, and the function is pretty simple so the flattened control flow is not hard to deal with.

Tracing through the function, we see that it grabs a `JNIEnv` via the helper function at `FUN_0026f0d0`, sets up a `JNINativeMethod` structure on the stack and then calls `env->RegisterNatives` to register a single function. The function pointer is either `FUN_002e71a4` or `FUN_002d8428` depending on some thread-local flag (run-time protection again?).

`FUN_002e71a4` is an obfuscated wrapper that calls `2d6288`. That calls `env->GetStringUTFChars`, `py::initialize_interpreter_` and `FUN_002bf3a8`. This latter function does some more string decryption, ultimately calling `pybind11::module_::import("pyloader")` and accessing the `import_checker` attribute: this is what kicks off the `pyloader.py` code we saw earlier.

### Python, again

`pyloader.py` loads a module from `__bc__`. This module won't decompile properly, so I decided to examine the disassembly (`dis.dis(marshal.loads(bytes.fromhex(__bc__.replace(" ", "").replace("\n", ""))[16:]))`):

```
  1           0 LOAD_CONST               0 (0)
              2 LOAD_CONST               1 (None)
              4 IMPORT_FROM              0 (android)
              6 STORE_NAME               0 (android)

  2           8 LOAD_CONST               0 (0)
             10 LOAD_CONST               1 (None)
             12 IMPORT_FROM              1 (json)
             14 STORE_NAME               1 (json)

  4          16 LOAD_CONST               2 ('data')
             18 LOAD_NAME                2 (str)
             20 LOAD_CONST               3 ('return')
             22 LOAD_NAME                3 (bool)
             24 BUILD_TUPLE              4
             26 LOAD_CONST               4 (<code object check at 0x109ae1dc0, file "/home/romain/dev/open-obfuscator/challenge/challenge-01/scripts/extra/checker.py", line 4>)
             28 LOAD_CONST               5 ('check')
             30 CALL_FUNCTION            4
             32 STORE_NAME               4 (check)

 10          34 LOAD_CONST               2 ('data')
             36 LOAD_NAME                2 (str)
             38 LOAD_CONST               3 ('return')
             40 LOAD_NAME                3 (bool)
             42 BUILD_TUPLE              4
             44 LOAD_CONST               6 (<code object verify at 0x109ae16e0, file "/home/romain/dev/open-obfuscator/challenge/challenge-01/scripts/extra/checker.py", line 10>)
             46 LOAD_CONST               7 ('verify')
             48 CALL_FUNCTION            4
             50 STORE_NAME               5 (verify)
             52 LOAD_CONST               1 (None)
             54 RETURN_VALUE

Disassembly of <code object check at 0x109ae1dc0, file "/home/romain/dev/open-obfuscator/challenge/challenge-01/scripts/extra/checker.py", line 4>:
  5           0 LOAD_GLOBAL              0 (json)
              2 CALL_METHOD              1
              4 STORE_FAST               0 (data)
              6 LIST_EXTEND              1
              8 UNPACK_SEQUENCE          2
             10 LOAD_FAST                1 (login)
             12 LOAD_FAST                2 (password)

  6          14 LOAD_GLOBAL              2 (android)
             16 CALL_METHOD              3
             18 STORE_FAST               1 (login)
             20 LIST_EXTEND              1
             22 LOAD_FAST                1 (login)

  7          24 LOAD_GLOBAL              2 (android)
             26 CALL_METHOD              3
             28 STORE_FAST               2 (password)
             30 LIST_EXTEND              1
             32 LOAD_FAST                2 (password)

  8          34 LOAD_GLOBAL              2 (android)
             36 CALL_METHOD              4
             38 STORE_FAST               1 (login)
             40 STORE_FAST               2 (password)
             42 BINARY_SUBTRACT
             44 LIST_EXTEND              1
             46 CALL_METHOD              5
             48 LIST_EXTEND              0
             50 LOAD_GLOBAL              2 (android)
             52 LOAD_ATTR                6 (__doc__)
             54 COMPARE_OP               2 (==)
             56 RETURN_VALUE

Disassembly of <code object verify at 0x109ae16e0, file "/home/romain/dev/open-obfuscator/challenge/challenge-01/scripts/extra/checker.py", line 10>:
 11           0 LOAD_GLOBAL              0 (len)
              2 STORE_FAST               0 (data)
              4 MAKE_FUNCTION            1 (defaults)
              6 LOAD_CONST               1 (0)
              8 COMPARE_OP               2 (==)
             10 RETURN_VALUE
```
<br />

This looks mostly reasonable, but some of the bytecodes look wrong: `IMPORT_FROM` should be `IMPORT_NAME`, `LOAD_FAST` should be `STORE_FAST`, etc. Indeed, we can guess that we're running on some kind of modified interpreter, where some of the opcodes have been swapped around. This is a popular obfuscation technique, but usually the opcodes are all permuted; swapping just some of the opcodes is a sneaky trick!

We can guess that the real code looks like this:

```python
import android
import json

def check(data: str) -> bool:
    login, password = json.loads(data)
    login = android.decode(login)
    password = android.decode(password)
    return android.__obfuscated__(login + password).hex() == android.__doc__

def verify(data: str) -> bool:
    return len(data) == 0
```
<br />

`__obfuscated__` is not in the `android` module. However, I found this string in the `python.elf` binary I compiled from `libpython3.10.a`: it's referenced in `_PyEval_EvalFrameDefault`:

```c
iVar6 = _PyUnicode_EqualToASCIIString((PyObject *)pPVar58,"__obfuscated__");
if (iVar6 != 0) {
  pPVar58 = (PyTypeObject *)PyUnicode_FromString("MvtKNJXCOGJe");
  (pPVar58->ob_base).ob_base.ob_refcnt = (pPVar58->ob_base).ob_base.ob_refcnt + 1;
}
```
<br />

So, the interpreter has also been hacked to replace mentions of `__obfuscated__` with `MvtKNJXCOGJe`, which is in the `android` module.

### Native code, again

Finally, we need to understand the `decode` (0x2c2640) and `MvtKNJXCOGJe` (0x2c32e0) functions. `decode` is straightforward base64 decoding with no obfuscation. `MvtKNJXCOGJe`, on the other hand, is heavily obfuscated: it's a wrapper for `FUN_002c0ea8`, which is a fairly long control-flow-flattened function. By following each of the state labels, it's easy enough to reconstruct the overall flow of the function.

It starts off by putting a bunch of stuff on the stack; a bit of emulation reveals the data:

```python
uc.reg_write(UC_ARM64_REG_SP, STACK_TOP)
uc.reg_write(UC_ARM64_REG_LR, END_ADDR)
uc.mem_write(STACK_TOP - 0x1000, b"\x00" * 0x1000)
uc.emu_start(0x1c0ea8, 0x1c0ef0) # initialize stack and persistent vars
uc.emu_start(0x1c10ec, 0x1c1990)
print(uc.mem_read(STACK_TOP - 0xc0, 0x40))
```
<br />

This produces `bytearray(b'expand 32-byte ke\x84tp~\xca//b\x92fu~\x93atb\x82.rh\xdf\x00\x00\r\xf0\x00\x00\r\xf0\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00')`. We can recognize this as the initial state of a ChaCha cipher with a counter and nonce of 0. Indeed, examining some of the functions that are called confirms this suspicion. `FUN_0030ca2c` in particular performs one double-round of the cipher:

```c
void FUN_0030ca2c(uint *param_1)
{
  FUN_0030c698(param_1,0,4,8,0xc);
  FUN_0030c698(param_1,1,5,9,0xd);
  FUN_0030c698(param_1,2,6,10,0xe);
  FUN_0030c698(param_1,3,7,0xb,0xf);
  FUN_0030c698(param_1,0,5,10,0xf);
  FUN_0030c698(param_1,1,6,0xb,0xc);
  FUN_0030c698(param_1,2,7,8,0xd);
  FUN_0030c698(param_1,3,4,9,0xe);
  return;
}
```
<br />

After encrypting the input with ChaCha, the `MvtKNJXCOGJe` function does the following:

```
uRam00007fff000cfe98 = 0;
while(1) {
  uRam00007fff000cfde8 = uRam00007fff000cfe98;
  p2_len = string::size((basic_string *)&obf_output);
  if (p2_len <= uRam00007fff000cfde8) {
    FUN_002bfc08(uVar12,&obf_output);
    FUN_0051e7d0(&obf_output);
    lVar6 = tpidr_el0;
    if (*(long *)(lVar6 + 0x28) == lRam00007fff000cffd8) {
      return;
    }
              // WARNING: Subroutine does not return
    __stack_chk_fail();
  }
  pbVar13 = (byte *)string::operator[](&obf_output,uRam00007fff000cfe98);
  /* obfuscated math elided... */
  iRam00007fff000cfde4 = (uint)bVar4 * 17;
  iVar2 = 256;
  iVar5 = 0;
  if (iVar2 != 0) {
    iVar5 = iRam00007fff000cfde4 / iVar2;
  }
  iRam00007fff000cfde4 -= iVar5 * iVar2;
  puVar14 = (undefined *)string::operator[](puVar7,uRam00007fff000cfe98);
  *puVar14 = (char)iRam00007fff000cfde4;
  uRam00007fff000cfe98 += 1;
}
```
<br />

So, this multiplies each byte with 17, mod 256. This all is easy enough to invert:

```python
data = bytes.fromhex('9c16a9c3017d2b3876323bc4f9dad2b7530c')
inv17 = pow(17, -1, 256)
data = bytes([(c * inv17) % 256 for c in data])

from Crypto.Cipher import ChaCha20
key = b"e\x84tp~\xca//b\x92fu~\x93atb\x82.rh\xdf\x00\x00\r\xf0\x00\x00\r\xf0\x00\x00"
cipher = ChaCha20.new(key=key, nonce=b'\x00' * 8)
print(cipher.decrypt(data))
```
<br />

And we get our final answer, `0MvLL_And_dPr0t3ct`. (Note that the key is simply `https://obfuscator.re/` NUL-padded to 32 bytes and XORed with the repeating key `\x0d\xf0\x00\x00`).

### Summary of the program flow

- Obfuscated Java/Kotlin code JSON-encodes `[base64(login), base64(password)]` and passes it to native code
- Obfuscated native code loads a hacked Python interpreter and an extension module `android` using pybind11
- Lightly obfuscated Python module loads the JSON and calls `android.MvtKNJXCOGJe(login + password)`
- `android.MvtKNJXCOGJe` uses ChaCha20 to encrypt the input, then multiplies each byte by 17
- The final result is compared against an obfuscated string constant.

### Summary of obfuscation techniques

- dProtect: very little program logic was in Java, so this had minimal impact. In particular, the package name `re.obfuscator.challenge01` was not obfuscated, nor were crucial functions like `toJson`.
- run-time checks: not applicable, static reversing only
- ELF protections: easily defeated (`rebuild_elf_sections.py` plus simply ignoring garbage symbols)
- arithmetic obfuscation: quite annoying in general, but fairly predictable as all encodings were applied the same number of times, making the overall "shape" of each obfuscated operation discernable.
- opaque constants: largely not an issue by setting `SP` at the start of each function
- opaque field access: as it depends on opaque constants, not an issue
- control-flow breaking: as it depends on opaque constants, not an issue
- control-flow flattening: definitely annoying; encryption of the variable was not impactful (Ghidra automatically constant-folds) but recovering control flow was done manually in most cases. (Tools exist, but the functions were not sizable enough to warrant using the tools)
- string encoding: surprisingly annoying, especially when written to the stack; the use of obfuscated arithmetic + randomized encoding algorithm meant that emulation was often the fastest way to recover strings
