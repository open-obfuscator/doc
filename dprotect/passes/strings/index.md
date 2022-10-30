+++
title       = "Strings Encryption"
description = "This pass obfuscates the strings present in Java/Kotlin methods."
icon        = "fa-regular fa-square-a-lock"
img_compare = true
+++

{{< hicon lvl=1 icon="fa-regular fa-square-a-lock" >}}Strings Encryption{{< /hicon >}}

{{< pass_purpose >}}
The purpose of this pass is to protect sensitive strings present in Java/Kotlin classes
{{< /pass_purpose >}}


{{< compare "svg/string-2.svg" "svg/string-1.svg" "dprotect">}}

The strings used within Java or Kotlin classes are a good indicator for reverse engineers.
This protection statically encodes strings such as the clear strings are only present at runtime
when the class' methods need them.

## How to use it?

This protection can be activated by using the `-obfuscate-strings` option in the dProtect configuration file:

```bash
-obfuscate-strings ...
```

`-obfuscate-strings` accepts two kinds of argument:

```bash
# 1. List of strings
-obfuscate-strings "hello*", "world"

# 2. Class specifications
-obfuscate-strings class dprotect.tests.string.TestObfuscationSyntax {
  private static java.lang.String API_KEY;
  public static java.lang.String sayHello();
}
```

##### 1. Class specifications

The regular usage of this option is very close to the `-keep` option[^keep-info]:

We define classes, methods, and fields for which, we want to obfuscate the strings.

To better understand the impact of this option, let's consider the following code:

```java
package re.obfuscator.dprotect;

public class MySensitiveClass {
  private static String API_KEY = "XEYnuNOGoEQtj7cFOPmXBMvQTE8FyAWC";
  boolean isAuth;

  public String getApiKey() {
    return String.format("TOKEN: %s", API_KEY);
  }

  public String toString() {
    return String.format("MySensitiveClass{isAuth: %b | Token: %s}",
                         isAuth, API_KEY);
  }
}
```

First, if we want to protect the API Key associated with the `API_KEY` attribute, we can use this definition:

```bash
# Class specifications
-obfuscate-strings class re.obfuscator.dprotect.MySensitiveClass {
  private static java.lang.String API_KEY;
}
```

This configuration produces this protection:

{{< compare "svg/jadx_1.svg" "svg/ref.svg" "dprotect">}}

If we also want to protect the string(s) in the `getApiKey()` method, we must add this definition:

```bash {hl_lines=4}
# Class specifications
-obfuscate-strings class re.obfuscator.dprotect.MySensitiveClass {
  private static java.lang.String API_KEY;
  public java.lang.String getApiKey();
}
```

This new definition provides the following changes:

{{< compare "svg/jadx_2.svg" "svg/jadx_1.svg" "dprotect">}}

Finally, we could protect all the strings of the class by using the wildcard option:

```bash {hl_lines=3}
# Class specifications
-obfuscate-strings class re.obfuscator.dprotect.MySensitiveClass {
  *;
}
```

And we get these transformations:

{{< compare "svg/jadx_3.svg" "svg/jadx_2.svg" "dprotect">}}

The details about the class specifications syntax are documented in the official Proguard documentation:
[ProGuard manual](https://www.guardsquare.com/manual/configuration/usage#classspecification).

Now, let's see how we can use a list of strings for the `-obfuscate-strings` option.

##### 2. List of strings

**In addition** to a class specifier, we can feed `-obfuscate-strings` with a list of strings delimited by a comma.

```bash
-obfuscate-strings "hello*", "world"
```

With this option, all the strings that match one of the elements specified in the list will be protected.

{{< admonition title="Class Specifications Required" icon="fa-regular fa-triangle-exclamation" color="danger">}}

<div class="mb-3 text-danger">
This option requires to be paired with class specifications.
Indeed, the pass does not iterate over all the strings
of all the classes to check if they match the obfuscation list provided by the user. This would strongly impact
the compilation time!<br /><br />
Instead, the input strings are sourced by the classes specified with the <code>-obfuscate-strings</code>
specifier:
</div>

{{< hicon lvl=6 icon="fa-regular fa-shield-exclamation" >}}Pitfall{{< /hicon >}}

```bash
# DOES NOT PROTECT ANY STRING
-obfuscate-strings "check*", "world"
```

{{< hicon lvl=6 icon="fa-regular fa-shield-check" >}}Protected{{< /hicon >}}

```bash
-obfuscate-strings "check*", "world"
-obfuscate-strings class dprotect.**
# Protect the strings "check" "check password ", "world", ...
# present in the package 'dprotect'
```
{{</ admonition >}}


## When to use it?

This pass should be enabled for all sensitive classes. We also recommend protecting **all the strings** of the
class as any clear string -- even though it might not seem sensitive at first sight -- could provide
information to reverse engineers.

## Implementation

The logic of the pass is located in the package `dprotect.obfuscation.strings`.

First, the `CodeObfuscator` filters the classes that have been flagged as string-obfuscated:

```java {hl_lines="5-11"}
programClassPool.accept(
    new AllClassVisitor(
    new ClassVisitor() {
      public void visitAnyClass(Clazz clazz) {
        if (ApplyStringObfuscation(clazz)) {
          // 1. Flag strings field
          markStringsField();

          // 2. Encode strings
          runObfuscator();
        }
      }
    }));
```

The initial step `markStringsField()` is used to mark strings that are associated with a class's attributes
that are marked as "*protected*" by the user:

```bash {hl_lines=3}
# Class specifications
-obfuscate-strings class re.obfuscator.dprotect.MySensitiveClass {
  private static java.lang.String API_KEY;
  public java.lang.String getApiKey();
}
```

To identify the strings that are paired with a class attribute, we basically try to fingerprint this sequence
of instructions:

```text
Code:
  1: ldc           #9   // java.lang.String <to protect>
  ...
  4: putfield      #14  // Field API_KEY:Ljava/lang/String;
```

This identification is performed by implementing the Proguard's `InstructionVisitor` and `ConstantVisitor`
which are used for *backtracking* the strings involved  in the `putfield/putstaticfield` instructions:

```java
// Pseudo-code for the logic of markStringsField()

public void visitConstantInstruction(...) {
  if (opcode == Instruction.OP_LDC) {
    // Keep a reference of the current string visited
    this.stringConstant = ...;
  }

  else if (opcode == Instruction.OP_PUTFIELD) {
    if (IsMarked(field) && this.stringConstant != null) {
      mark(this.stringConstant);
    }
  }
}
```

Once the strings associated with fields are marked, we can process the whole class for the obfuscation:

```java {hl_lines="5"}
// 1. Flag strings field
markStringsField();

// 2. Obfuscate strings
runObfuscator();
```

The overall logic behind `runObfuscator` is to:

1. Inject a decoding routine in the classes for which strings must be protected.
2. Replace all the strings with their encoded representation.
3. Add a call to the injected decoding routine for the encoded strings.

For the first step, the idea is very similar to the [O-MVLL String Encoding]({{< ref "/omvll/passes/strings-encoding" >}})
pass:

<center class="mb-2">
We <strong><i>JIT</i> predefined </strong> encoding routines.
</center>

The class `dprotect.runtime.strings.StringEncoding` implements a set of encoding/decoding routines that
are used for the injection.

{{< svg_local "./svg/overview.svg" >}}


The idea of this injection is that, on one hand, Proguard has all the functionalities to add, create and
modify the class' methods. Therefore, given a compiled `.class` file, we could **copy** the bytecode of a
specific method within the class that aims to welcome the decoding routine.

On the other hand, the Java bytecode associated with the injected routine can also be executed by the pass itself
to get the encoded string.

The injection of the decoding routine is performed by the following (pseudo) code:

```java
// Class in which we want to inject the decoding routine
ProgramClass target = ...
ClassBuilder builder = new ClassBuilder(target);
// Create a (empty) method into the targeted class
ProgramMethod decodingRoutine = builder.addAndReturnMethod(
    AccessConstants.STATIC,
    /* Name      */ "myDecodingRoutine",
    /* Prototype */ "(Ljava/lang/String;)Ljava/lang/String;");

// Lift the bytecode into target.myDecodingRoutine
//                   from StringEncoding.myDecodingRoutine
MethodCopier.copy(target, decodingRoutine,
                  StringEncoding.class, "decodingRoutine");
```

{{< admonition title="MethodCopier" icon="fa-regular fa-gears" color="info">}}
`MethodCopier` is not present in the original version of ProguardCORE and has been added for the purpose
of this pass.
{{< /admonition >}}

Once the decoding routine injected into the targeted class, we can address the next points which
consist in replacing the original strings with their encoded representation.

For that purpose, we can combine the following Proguard's visitors (pseudo-code):

```java
// AttributeVisitor.
@Override
public void visitCodeAttribute(Clazz clazz, Method method, ...) {
  // Prepare the "editors" and trigger the instructions visitor
  constantPoolEditor = new ConstantPoolEditor((ProgramClass)clazz);
  codeAttributeEditor.reset(codeAttribute.u4codeLength);

  // Trigger InstructionVisitor that is implemetned by the same class
  codeAttribute.instructionsAccept(clazz, method, this);
}


// InstructionVisitor.
@Override
public void visitConstantInstruction(Clazz               clazz,
                                     Method              method,
                                     CodeAttribute       codeAttribute,
                                     int                 offset,
                                     ConstantInstruction instruction) {

  // Filter on the LDC/LDC_W opcodes which load strings
  if (instruction.opcode == Instruction.OP_LDC ||
      instruction.opcode == Instruction.OP_LDC_W) {


    // Find the decoding routine which has been injected in the step 1
    Method decodingRoutine = clazz.findMethod(...);

    // Create a static-call instruction for the decoding routine
    Instruction call = new ConstantInstruction(Instruction.OP_INVOKESTATIC,
                                               decodingRoutine);

    // Replace the string with its encoded version
    String encoded = encode(originalString);
    instruction.constantIndex = constantPoolEditor.addStringConstant(encoded);
    codeEditor.replaceInstruction(offset, instruction);

    // Add the static call to the decoding routine
    codeEditor.insertAfterInstruction(offset, replacementInstruction);
  }
}
```

In the previous snippet, `String encoded = encode(originalString)` actually uses Java reflection to
call the encoding routine implemented in `StringEncoding` (whilst the decoding routine has been injected with
`MethodCopier` in the class).

The full implementation is a bit more complex but the previous description provides a good overview of the
process.

## Limitations

Regarding the limitations, this pass might introduce a certain overhead on the size of the final application since
a new method is added for all the classes in which strings must be protected. Nevertheless, this overhead is
balanced by the fact that the decoding routines are usually small and self-consistent.

The decoding routine could also be hooked by an attacker to access the clear string at runtime.
Nevertheless, this would require to setup hooks for **all the classes** as the decoding routines
are local and different for each class.

[^keep-info]: `-obfuscate-string` relies on the same parser as the `-keep` option.
