package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyExecutionRecords.*;
import com.procurement.agency.infrastructure.AgencyDocumentPreviewMapper;
import com.procurement.agency.infrastructure.AgencyDocumentPreviewMapper.Preview;
import com.procurement.attachment.application.AttachmentArtifactWriter;
import com.procurement.common.document.LocalDocumentTools;
import java.io.*;
import java.util.*;
import java.util.zip.*;
import javax.xml.parsers.DocumentBuilderFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyDocumentPreviewService {
  final AgencyExecutionSupport s;
  final AgencyDocumentService docs;
  final AgencyDocumentPreviewMapper data;
  final LocalDocumentTools tools;
  final AttachmentArtifactWriter writer;

  public AgencyDocumentPreviewService(
      AgencyExecutionSupport s,
      AgencyDocumentService docs,
      AgencyDocumentPreviewMapper data,
      LocalDocumentTools tools,
      AttachmentArtifactWriter writer) {
    this.s = s;
    this.docs = docs;
    this.data = data;
    this.tools = tools;
    this.writer = writer;
  }

  Revision revision(String id) {
    var r = s.data.revision(s.guard.tenant(), id);
    if (r == null) throw new IllegalArgumentException("候选版本不存在");
    docs.require(r.documentId(), false);
    return r;
  }

  public record View(Preview preview, String attachmentId) {}

  public List<View> list(String id) {
    revision(id);
    return data.previews(s.guard.tenant(), id).stream()
        .map(p -> new View(p, s.sourceVersion(p.fileVersionId(), p.packageId()).attachmentId()))
        .toList();
  }

  @Transactional
  public Job create(String id, String key) {
    var r = revision(id);
    var doc = docs.require(r.documentId(), false);
    s.guard.requireApproved(doc.packageId());
    s.guard.permissions().require("buyer:agency:document:preview");
    s.guard.permissions().require("buyer:agency:file:manage");
    s.packages.lock(s.guard.tenant(), doc.packageId());
    s.sourceVersion(r.fileVersionId(), doc.packageId());
    s.text(key, 100, true, "幂等键");
    String k = "preview:" + key, h = s.begin(k, Arrays.asList(id, r.hash()));
    var cached = s.remembered(k);
    if (cached != null) return s.json.read(cached, Job.class);
    String job = "agency-job-" + UUID.randomUUID();
    s.data.enqueue(
        s.guard.tenant(),
        job,
        doc.packageId(),
        "preview",
        doc.id(),
        r.inputVersion(),
        s.json.write(Map.of("revisionId", id, "sourceHash", r.hash())),
        s.guard.actor());
    var result = s.data.job(s.guard.tenant(), job);
    s.remember(k, h, result);
    return result;
  }

  public byte[] render(Job job) {
    var r = revision(s.json.tree(job.payloadJson()).path("revisionId").asText());
    var d = docs.require(r.documentId(), false);
    s.guard.permissions().require("buyer:agency:document:preview");
    var source = s.source(r.fileVersionId(), d.packageId());
    if (!source.hash().equals(r.hash())
        || !s.json.tree(job.payloadJson()).path("sourceHash").asText().equals(r.hash()))
      throw new IllegalStateException("预览原始版本指纹不一致");
    safeForConversion(source.bytes());
    return tools.pdf(source.bytes());
  }

  public static void safeForConversion(byte[] bytes) {
    if (bytes == null || bytes.length > 10 * 1024 * 1024)
      throw new IllegalArgumentException("Word超过转换范围");
    boolean document = false;
    try (var zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
      ZipEntry e;
      long total = 0;
      int count = 0;
      while ((e = zip.getNextEntry()) != null) {
        if (++count > 5000 || e.getName().contains(".."))
          throw new IllegalArgumentException("Word结构超出转换范围");
        byte[] value = zip.readNBytes(8 * 1024 * 1024 + 1);
        total += value.length;
        if (value.length > 8 * 1024 * 1024 || total > 60L * 1024 * 1024)
          throw new IllegalArgumentException("Word解压内容超过限制");
        String name = e.getName().toLowerCase(Locale.ROOT);
        if (name.equals("word/document.xml")) document = true;
        if (name.endsWith(".xml") || name.endsWith(".rels")) {
          var f = DocumentBuilderFactory.newInstance();
          f.setNamespaceAware(true);
          f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
          f.setFeature("http://xml.org/sax/features/external-general-entities", false);
          f.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
          f.setXIncludeAware(false);
          f.setExpandEntityReferences(false);
          f.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_DTD, "");
          f.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
          var xml = f.newDocumentBuilder().parse(new ByteArrayInputStream(value));
          var rows = xml.getElementsByTagNameNS("*", "Relationship");
          for (int i = 0; i < rows.getLength(); i++) {
            var row = (org.w3c.dom.Element) rows.item(i);
            if ((row.getAttribute("TargetMode").equalsIgnoreCase("External")
                    || row.getAttribute("Target").matches("^[A-Za-z][A-Za-z0-9+.-]*:.*")
                    || row.getAttribute("Target").startsWith("//")
                    || row.getAttribute("Target").startsWith("\\"))
                && !row.getAttribute("Type").endsWith("/hyperlink"))
              throw new IllegalArgumentException("Word含外部关联资源，须先本地化后预览");
          }
          // Parse XML before inspecting field instructions, including UTF-16 and split runs.
          StringBuilder fields = new StringBuilder();
          for (String tag : List.of("instrText", "fldSimple")) {
            var nodes = xml.getElementsByTagNameNS("*", tag);
            for (int i = 0; i < nodes.getLength(); i++) {
              var node = (org.w3c.dom.Element) nodes.item(i);
              fields.append(node.getTextContent());
              if (tag.equals("fldSimple"))
                fields
                    .append(" ")
                    .append(
                        node.getAttributeNS(
                            "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
                            "instr"))
                    .append(" ");
            }
          }
          String instructions = fields.toString().toUpperCase(Locale.ROOT);
          String compact = instructions.replaceAll("\\s+", "");
          if (compact.contains("DDE")
              || compact.contains("INCLUDETEXT")
              || compact.contains("INCLUDEPICTURE")
              || compact.contains("DATABASE")
              || java.util.regex.Pattern.compile("(?s)(?:^|\\s)LINK(?:\\s|$)")
                  .matcher(instructions)
                  .find()) throw new IllegalArgumentException("Word含动态外部域，须先人工处理再预览");
        }
      }
      if (!document) throw new IllegalArgumentException("缺少Word正文，无法转换");
    } catch (IllegalArgumentException e) {
      throw e;
    } catch (Exception e) {
      throw new IllegalArgumentException("Word文件结构无法安全转换");
    }
  }

  @Transactional
  public Preview finish(Job job, byte[] bytes) {
    var r = revision(s.json.tree(job.payloadJson()).path("revisionId").asText());
    var d = docs.require(r.documentId(), false);
    s.guard.requireApproved(d.packageId());
    s.guard.permissions().require("buyer:agency:document:preview");
    s.guard.permissions().require("buyer:agency:file:manage");
    s.packages.lock(s.guard.tenant(), d.packageId());
    var current = s.data.lockJob(s.guard.tenant(), job.id());
    if (current == null
        || !current.status().equals("processing")
        || current.attempts() != job.attempts()
        || !Objects.equals(current.startedAt(), job.startedAt()))
      throw new IllegalStateException("预览任务已失效");
    s.sourceVersion(r.fileVersionId(), d.packageId());
    var old = data.previews(s.guard.tenant(), r.id());
    if (!old.isEmpty()) {
      s.data.finishJob(
          s.guard.tenant(),
          job.id(),
          "success",
          s.json.write(
              Map.of(
                  "previewId",
                  old.getFirst().id(),
                  "fileVersionId",
                  old.getFirst().fileVersionId())),
          null);
      return old.getFirst();
    }
    String file = "agency-file-" + UUID.randomUUID(),
        version = "agency-fv-" + UUID.randomUUID(),
        name = "采购文书预览-" + r.id() + ".pdf";
    s.packages.createFile(
        s.guard.tenant(),
        file,
        d.packageId(),
        name,
        "generated_document",
        "project",
        s.guard.actor());
    s.packages.createVersion(
        s.guard.tenant(), version, file, 1, s.guard.actor(), "精确DOCX版本PDF预览，不替代审批和签署");
    var saved = writer.write("agency_file_version", version, name, "application/pdf", bytes);
    if (s.packages.seal(s.guard.tenant(), version, saved.attachmentId(), saved.hash(), saved.size())
        != 1) throw new IllegalStateException("PDF预览封存失败");
    var preview =
        new Preview(
            "agency-preview-" + UUID.randomUUID(),
            s.guard.tenant(),
            d.packageId(),
            r.id(),
            r.hash(),
            version,
            saved.hash(),
            job.id(),
            s.guard.actor(),
            null);
    data.create(preview);
    s.data.finishJob(
        s.guard.tenant(),
        job.id(),
        "success",
        s.json.write(
            Map.of("previewId", preview.id(), "fileVersionId", version, "hash", saved.hash())),
        null);
    s.event(
        d.packageId(),
        "document_preview",
        preview.id(),
        null,
        Map.of("sourceRevisionId", r.id(), "sourceHash", r.hash(), "pdfHash", saved.hash()),
        "PDF为指定DOCX的派生预览，不改变审批稿或当前版本");
    return preview;
  }
}
