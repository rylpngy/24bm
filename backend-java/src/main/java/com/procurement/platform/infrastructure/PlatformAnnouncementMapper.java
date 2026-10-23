package com.procurement.platform.infrastructure;

import com.procurement.platform.domain.PlatformAnnouncement;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface PlatformAnnouncementMapper {

  @Select("""
      select id, title, content, audience, status, published_by, created_at
      from platform_announcements
      order by created_at desc, id
      """)
  List<PlatformAnnouncement> listForManagement();

  @Select("""
      select id, title, content, audience, status, published_by, created_at
      from platform_announcements
      where status = 'active'
      order by created_at desc
      """)
  List<PlatformAnnouncement> listActive();

  @Select("""
      select id, title, content, audience, status, published_by, created_at
      from platform_announcements
      where status = 'active'
        and audience in (#{sharedAudience}, #{specificAudience})
      order by created_at desc
      """)
  List<PlatformAnnouncement> listActiveForAudiences(
      @Param("sharedAudience") String sharedAudience,
      @Param("specificAudience") String specificAudience);

  @Select("""
      select id, title, content, audience, status, published_by, created_at
      from platform_announcements
      where id = #{id}
      """)
  PlatformAnnouncement findById(@Param("id") String id);

  @Insert("""
      insert into platform_announcements (id, title, content, audience, status, published_by)
      values (#{id}, #{title}, #{content}, #{audience}, #{status}, #{publishedBy})
      """)
  void insert(
      @Param("id") String id,
      @Param("title") String title,
      @Param("content") String content,
      @Param("audience") String audience,
      @Param("status") String status,
      @Param("publishedBy") String publishedBy);

  @Update("""
      update platform_announcements
      set title = #{title},
          content = #{content},
          audience = #{audience}
      where id = #{id}
        and status = #{expectedStatus}
      """)
  int updateContent(
      @Param("id") String id,
      @Param("title") String title,
      @Param("content") String content,
      @Param("audience") String audience,
      @Param("expectedStatus") String expectedStatus);

  @Update("""
      update platform_announcements
      set status = #{nextStatus}
      where id = #{id}
        and status = #{expectedStatus}
      """)
  int updateStatus(
      @Param("id") String id,
      @Param("expectedStatus") String expectedStatus,
      @Param("nextStatus") String nextStatus);
}
